import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface CachedQuery {
  url: string;
  data: unknown;
  timestamp: number;
}

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface OutboxAction {
  actionId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  tempId?: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: number;
}

export interface TempIdMapping {
  tempId: string;
  serverId: string;
  entityType: string;
  createdAt: number;
}

export interface OfflinePhoto {
  photoId: string;
  blob: Blob;
  metadata: Record<string, unknown>;
  tempId?: string;
  status: 'pending' | 'uploading' | 'uploaded';
  createdAt: number;
}

interface BuildPlusOfflineDB extends DBSchema {
  queryCache: {
    key: string;
    value: CachedQuery;
    indexes: { 'by-timestamp': number };
  };
  outbox: {
    key: string;
    value: OutboxAction;
    indexes: {
      'by-status': OutboxStatus;
      'by-createdAt': number;
      'by-status-createdAt': [OutboxStatus, number];
    };
  };
  tempIdMap: {
    key: string;
    value: TempIdMapping;
  };
  offlinePhotos: {
    key: string;
    value: OfflinePhoto;
    indexes: { 'by-status': string };
  };
}

const DB_NAME = 'buildplus-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<BuildPlusOfflineDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<BuildPlusOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<BuildPlusOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('queryCache')) {
        const queryStore = db.createObjectStore('queryCache', { keyPath: 'url' });
        queryStore.createIndex('by-timestamp', 'timestamp');
      }

      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'actionId' });
        outboxStore.createIndex('by-status', 'status');
        outboxStore.createIndex('by-createdAt', 'createdAt');
        outboxStore.createIndex('by-status-createdAt', ['status', 'createdAt']);
      }

      if (!db.objectStoreNames.contains('tempIdMap')) {
        db.createObjectStore('tempIdMap', { keyPath: 'tempId' });
      }

      if (!db.objectStoreNames.contains('offlinePhotos')) {
        const photoStore = db.createObjectStore('offlinePhotos', { keyPath: 'photoId' });
        photoStore.createIndex('by-status', 'status');
      }
    },
    blocked() {
      console.warn('[Offline DB] Database upgrade blocked by other tabs');
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
    },
  });

  return dbInstance;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

export function generateTempId(): string {
  return 'temp-' + generateId();
}
