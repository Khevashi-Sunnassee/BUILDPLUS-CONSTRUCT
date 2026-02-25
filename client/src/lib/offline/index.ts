export { getDB, generateId, generateTempId } from './db';
export type { OutboxAction, OutboxStatus, CachedQuery, OfflinePhoto, TempIdMapping } from './db';

export {
  getCachedQuery,
  setCachedQuery,
  addOutboxAction,
  getOutboxActions,
  getPendingActions,
  updateOutboxAction,
  removeOutboxAction,
  clearSyncedActions,
  getOutboxCount,
  getOutboxSummary,
  setTempIdMapping,
  getTempIdMapping,
  resolveId,
  saveOfflinePhoto,
  getOfflinePhoto,
  getOfflinePhotos,
  updateOfflinePhotoStatus,
  removeOfflinePhoto,
  cleanupOldCache,
  getStorageEstimate,
} from './store';

export { ACTION_TYPES, ENTITY_TYPES, isCreateAction, getActionPriority, getActionDescription } from './action-types';
export type { ActionType, EntityType } from './action-types';

export { syncEngine } from './sync-engine';
export type { SyncStatus } from './sync-engine';

export { useOnlineStatus, useOfflineQuery, useOfflineMutation, useOfflineCapable, usePendingCount } from './hooks';

export { registerServiceWorker } from './register-sw';
