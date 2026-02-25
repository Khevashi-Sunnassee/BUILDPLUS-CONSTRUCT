import { getDB, type OutboxAction, type OutboxStatus, type CachedQuery, type OfflinePhoto, type TempIdMapping, generateId } from './db';

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCachedQuery<T = unknown>(url: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const db = await getDB();
    const entry = await db.get('queryCache', url);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
      await db.delete('queryCache', url);
      return null;
    }
    return { data: entry.data as T, timestamp: entry.timestamp };
  } catch (e) {
    console.warn('[Offline Store] getCachedQuery failed:', e);
    return null;
  }
}

export async function setCachedQuery(url: string, data: unknown): Promise<void> {
  try {
    const db = await getDB();
    const entry: CachedQuery = { url, data, timestamp: Date.now() };
    await db.put('queryCache', entry);
  } catch (e) {
    console.warn('[Offline Store] setCachedQuery failed:', e);
  }
}

export async function addOutboxAction(
  action: Omit<OutboxAction, 'actionId' | 'status' | 'createdAt' | 'retryCount'>
): Promise<OutboxAction> {
  const db = await getDB();
  const fullAction: OutboxAction = {
    ...action,
    actionId: generateId(),
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
  };
  await db.put('outbox', fullAction);
  return fullAction;
}

export async function getOutboxActions(status?: OutboxStatus): Promise<OutboxAction[]> {
  const db = await getDB();
  if (status) {
    return db.getAllFromIndex('outbox', 'by-status', status);
  }
  return db.getAll('outbox');
}

export async function getPendingActions(): Promise<OutboxAction[]> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('outbox', 'by-status', 'pending');
  const now = Date.now();
  return pending
    .filter(a => !a.nextRetryAt || a.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOutboxAction(
  actionId: string,
  updates: Partial<OutboxAction>
): Promise<void> {
  const db = await getDB();
  const action = await db.get('outbox', actionId);
  if (!action) return;
  const updated = { ...action, ...updates };
  await db.put('outbox', updated);
}

export async function removeOutboxAction(actionId: string): Promise<void> {
  const db = await getDB();
  await db.delete('outbox', actionId);
}

export async function clearSyncedActions(): Promise<number> {
  const db = await getDB();
  const synced = await db.getAllFromIndex('outbox', 'by-status', 'synced');
  const tx = db.transaction('outbox', 'readwrite');
  let count = 0;
  for (const action of synced) {
    await tx.store.delete(action.actionId);
    count++;
  }
  await tx.done;
  return count;
}

export async function getOutboxCount(): Promise<number> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('outbox', 'by-status', 'pending');
  const syncing = await db.getAllFromIndex('outbox', 'by-status', 'syncing');
  const failed = await db.getAllFromIndex('outbox', 'by-status', 'failed');
  return pending.length + syncing.length + failed.length;
}

export async function getOutboxSummary(): Promise<{ pending: number; syncing: number; failed: number; synced: number }> {
  const db = await getDB();
  const all = await db.getAll('outbox');
  const summary = { pending: 0, syncing: 0, failed: 0, synced: 0 };
  for (const a of all) {
    summary[a.status]++;
  }
  return summary;
}

export async function setTempIdMapping(tempId: string, serverId: string, entityType: string): Promise<void> {
  const db = await getDB();
  const mapping: TempIdMapping = { tempId, serverId, entityType, createdAt: Date.now() };
  await db.put('tempIdMap', mapping);
}

export async function getTempIdMapping(tempId: string): Promise<TempIdMapping | null> {
  const db = await getDB();
  const mapping = await db.get('tempIdMap', tempId);
  return mapping || null;
}

export async function resolveId(id: string): Promise<string> {
  if (!id || !id.startsWith('temp-')) return id;
  const mapping = await getTempIdMapping(id);
  return mapping?.serverId || id;
}

export async function saveOfflinePhoto(photoId: string, blob: Blob, metadata: Record<string, unknown>, tempId?: string): Promise<void> {
  const db = await getDB();
  const photo: OfflinePhoto = {
    photoId,
    blob,
    metadata,
    tempId,
    status: 'pending',
    createdAt: Date.now(),
  };
  await db.put('offlinePhotos', photo);
}

export async function getOfflinePhoto(photoId: string): Promise<OfflinePhoto | null> {
  const db = await getDB();
  const photo = await db.get('offlinePhotos', photoId);
  return photo || null;
}

export async function getOfflinePhotos(status?: string): Promise<OfflinePhoto[]> {
  const db = await getDB();
  if (status) {
    return db.getAllFromIndex('offlinePhotos', 'by-status', status);
  }
  return db.getAll('offlinePhotos');
}

export async function updateOfflinePhotoStatus(photoId: string, status: OfflinePhoto['status']): Promise<void> {
  const db = await getDB();
  const photo = await db.get('offlinePhotos', photoId);
  if (!photo) return;
  photo.status = status;
  await db.put('offlinePhotos', photo);
}

export async function removeOfflinePhoto(photoId: string): Promise<void> {
  const db = await getDB();
  await db.delete('offlinePhotos', photoId);
}

export async function cleanupOldCache(): Promise<void> {
  try {
    const db = await getDB();
    const cutoff = Date.now() - CACHE_MAX_AGE_MS;
    const tx = db.transaction('queryCache', 'readwrite');
    const index = tx.store.index('by-timestamp');
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (e) {
    console.warn('[Offline Store] cleanupOldCache failed:', e);
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentUsed: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return null;
  }
}
