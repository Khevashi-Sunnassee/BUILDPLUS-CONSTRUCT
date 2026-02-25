import {
  getPendingActions,
  updateOutboxAction,
  removeOutboxAction,
  clearSyncedActions,
  getOutboxCount,
  resolveId,
  setTempIdMapping,
  getOfflinePhoto,
  updateOfflinePhotoStatus,
  removeOfflinePhoto,
} from './store';
import { ACTION_TYPES, isCreateAction, getActionPriority } from './action-types';
import { apiRequest, apiUpload, getCsrfToken } from '../queryClient';
import type { OutboxAction } from './db';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const SYNC_INTERVAL_MS = 30_000;
const MIN_RETRY_DELAY_MS = 2_000;

class SyncEngineImpl {
  private status: SyncStatus = 'idle';
  private listeners = new Set<SyncListener>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener('online', () => {
      this.setStatus('idle');
      this.processOutbox();
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
      this.stopTimer();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.processOutbox();
        this.startTimer();
      } else {
        this.stopTimer();
      }
    });

    if (navigator.onLine) {
      this.setStatus('idle');
      setTimeout(() => this.processOutbox(), 2000);
      this.startTimer();
    } else {
      this.setStatus('offline');
    }
  }

  private startTimer(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.processOutbox();
      }
    }, SYNC_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    getOutboxCount().then(count => listener(this.status, count));
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.notifyListeners();
  }

  private async notifyListeners(): Promise<void> {
    const count = await getOutboxCount();
    for (const listener of this.listeners) {
      try {
        listener(this.status, count);
      } catch (e) {
        console.warn('[SyncEngine] Listener error:', e);
      }
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async triggerSync(): Promise<void> {
    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }
    await this.processOutbox();
  }

  async processOutbox(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;

    const pending = await getPendingActions();
    if (pending.length === 0) {
      await clearSyncedActions();
      this.setStatus('idle');
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    const sorted = [...pending].sort((a, b) => {
      const pA = getActionPriority(a.actionType);
      const pB = getActionPriority(b.actionType);
      if (pA !== pB) return pA - pB;
      return a.createdAt - b.createdAt;
    });

    let hasErrors = false;

    for (const action of sorted) {
      if (!navigator.onLine) {
        this.setStatus('offline');
        break;
      }

      try {
        await updateOutboxAction(action.actionId, { status: 'syncing' });
        await this.notifyListeners();

        const result = await this.executeAction(action);

        if (result.success) {
          await updateOutboxAction(action.actionId, { status: 'synced' });
          if (result.serverId && action.tempId) {
            await setTempIdMapping(action.tempId, result.serverId, action.entityType);
          }
          if (action.actionType === ACTION_TYPES.PHOTO_UPLOAD && action.entityId) {
            await updateOfflinePhotoStatus(action.entityId, 'uploaded');
            setTimeout(() => removeOfflinePhoto(action.entityId!), 60_000);
          }
        } else {
          throw new Error(result.error || 'Unknown sync error');
        }
      } catch (err) {
        hasErrors = true;
        const error = err instanceof Error ? err : new Error(String(err));
        const errorMsg = error.message;

        if (errorMsg.startsWith('401')) {
          await updateOutboxAction(action.actionId, {
            status: 'pending',
            lastError: 'Session expired — please log in again',
          });
          this.setStatus('error');
          this.isSyncing = false;
          await this.notifyListeners();
          return;
        }

        if (errorMsg.startsWith('409') || errorMsg.startsWith('422') || errorMsg.startsWith('400')) {
          await updateOutboxAction(action.actionId, {
            status: 'failed',
            lastError: errorMsg,
          });
        } else {
          const newRetryCount = action.retryCount + 1;
          const delay = Math.min(MIN_RETRY_DELAY_MS * Math.pow(2, newRetryCount), MAX_RETRY_DELAY_MS);
          await updateOutboxAction(action.actionId, {
            status: 'pending',
            retryCount: newRetryCount,
            lastError: errorMsg,
            nextRetryAt: Date.now() + delay,
          });
        }
      }

      await this.notifyListeners();
    }

    await clearSyncedActions();
    this.isSyncing = false;
    this.setStatus(hasErrors ? 'error' : 'idle');
    await this.notifyListeners();

    if (!hasErrors) {
      this.startTimer();
    }
  }

  private async executeAction(action: OutboxAction): Promise<{ success: boolean; serverId?: string; error?: string }> {
    const entityId = action.entityId ? await resolveId(action.entityId) : undefined;

    switch (action.actionType) {
      case ACTION_TYPES.TASK_CREATE: {
        const res = await apiRequest('POST', '/api/tasks', action.payload);
        const data = await res.json();
        return { success: true, serverId: data.id };
      }

      case ACTION_TYPES.TASK_UPDATE: {
        if (!entityId) return { success: false, error: 'No task ID' };
        await apiRequest('PATCH', `/api/tasks/${entityId}`, action.payload);
        return { success: true };
      }

      case ACTION_TYPES.TASK_STATUS_CHANGE: {
        if (!entityId) return { success: false, error: 'No task ID' };
        await apiRequest('PATCH', `/api/tasks/${entityId}`, action.payload);
        return { success: true };
      }

      case ACTION_TYPES.TASK_COMMENT_ADD: {
        if (!entityId) return { success: false, error: 'No task ID' };
        await apiRequest('POST', `/api/tasks/${entityId}/updates`, action.payload);
        return { success: true };
      }

      case ACTION_TYPES.TASK_ATTACH_PHOTO: {
        if (!entityId) return { success: false, error: 'No task ID' };
        const photoId = action.payload.photoId as string;
        if (!photoId) return { success: false, error: 'No photo ID' };
        const photo = await getOfflinePhoto(photoId);
        if (!photo) return { success: false, error: 'Photo not found in local storage' };
        const formData = new FormData();
        const ext = photo.metadata.mimeType ? (photo.metadata.mimeType as string).split('/')[1] : 'jpg';
        formData.append('file', photo.blob, `photo.${ext}`);
        await apiUpload(`/api/tasks/${entityId}/files`, formData);
        return { success: true };
      }

      case ACTION_TYPES.CHECKLIST_CREATE: {
        const res = await apiRequest('POST', '/api/checklist/instances', action.payload);
        const data = await res.json();
        return { success: true, serverId: data.id };
      }

      case ACTION_TYPES.CHECKLIST_UPDATE: {
        if (!entityId) return { success: false, error: 'No checklist ID' };
        await apiRequest('PUT', `/api/checklist/instances/${entityId}`, action.payload);
        return { success: true };
      }

      case ACTION_TYPES.CHECKLIST_COMPLETE: {
        if (!entityId) return { success: false, error: 'No checklist ID' };
        await apiRequest('PATCH', `/api/checklist/instances/${entityId}/complete`, {});
        return { success: true };
      }

      case ACTION_TYPES.PHOTO_UPLOAD: {
        const photoId = action.entityId;
        if (!photoId) return { success: false, error: 'No photo ID' };
        const photo = await getOfflinePhoto(photoId);
        if (!photo) return { success: false, error: 'Photo not found' };
        const formData = new FormData();
        const ext = photo.metadata.mimeType ? (photo.metadata.mimeType as string).split('/')[1] : 'jpg';
        const fileName = (photo.metadata.fileName as string) || `photo-${Date.now()}.${ext}`;
        formData.append('file', photo.blob, fileName);
        if (photo.metadata.title) formData.append('title', photo.metadata.title as string);
        if (photo.metadata.jobId) formData.append('jobId', photo.metadata.jobId as string);
        if (photo.metadata.disciplineId) formData.append('disciplineId', photo.metadata.disciplineId as string);
        if (photo.metadata.description) formData.append('description', photo.metadata.description as string);
        if (photo.metadata.typeId) formData.append('typeId', photo.metadata.typeId as string);
        if (photo.metadata.isPublic !== undefined) formData.append('isPublic', String(photo.metadata.isPublic));
        const res = await apiUpload('/api/documents/upload', formData);
        const data = await res.json();
        return { success: true, serverId: data.id };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.actionType}` };
    }
  }

  destroy(): void {
    this.stopTimer();
    this.listeners.clear();
    this.isInitialized = false;
  }
}

export const syncEngine = new SyncEngineImpl();
