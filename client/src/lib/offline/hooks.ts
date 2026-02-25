import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, type UseQueryResult, type UseMutationResult, type UseQueryOptions } from '@tanstack/react-query';
import { queryClient } from '../queryClient';
import { getCachedQuery, setCachedQuery, addOutboxAction, getOutboxCount } from './store';
import { syncEngine, type SyncStatus } from './sync-engine';
import { generateTempId } from './db';
import type { ActionType } from './action-types';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncEngine.subscribe((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback(() => {
    syncEngine.triggerSync();
  }, []);

  return { isOnline, syncStatus, pendingCount, triggerSync };
}

const OFFLINE_CACHEABLE_PREFIXES = [
  '/api/task-groups',
  '/api/tasks',
  '/api/checklist/templates',
  '/api/checklist/instances',
  '/api/documents',
  '/api/jobs',
  '/api/panels',
  '/api/settings/logo',
  '/api/admin/factories',
];

function isCacheableUrl(url: string): boolean {
  return OFFLINE_CACHEABLE_PREFIXES.some(prefix => url.startsWith(prefix));
}

export function useOfflineQuery<T>(
  queryKey: readonly unknown[],
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey'>
): UseQueryResult<T, Error> & { isCachedData: boolean } {
  const [cachedData, setCachedData] = useState<T | undefined>(undefined);
  const [isCachedData, setIsCachedData] = useState(false);
  const url = queryKey[0] as string;
  const shouldCache = isCacheableUrl(url);

  useEffect(() => {
    if (!shouldCache) return;
    let cancelled = false;
    getCachedQuery<T>(url).then(cached => {
      if (!cancelled && cached) {
        setCachedData(cached.data);
      }
    });
    return () => { cancelled = true; };
  }, [url, shouldCache]);

  const queryResult = useQuery<T, Error>({
    ...options,
    queryKey,
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.startsWith('401') || msg.startsWith('403') || msg.startsWith('404')) return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (queryResult.data && shouldCache) {
      setCachedQuery(url, queryResult.data);
      setIsCachedData(false);
    }
  }, [queryResult.data, url, shouldCache]);

  if (queryResult.isError && !queryResult.data && cachedData && shouldCache) {
    return {
      ...queryResult,
      data: cachedData,
      isLoading: false,
      isError: false,
      isCachedData: true,
    } as UseQueryResult<T, Error> & { isCachedData: boolean };
  }

  return { ...queryResult, isCachedData };
}

interface OfflineMutationOptions<TVariables, TData = unknown> {
  actionType: ActionType;
  entityType: string;
  getEntityId?: (variables: TVariables) => string | undefined;
  getTempId?: (variables: TVariables) => string | undefined;
  buildPayload: (variables: TVariables) => Record<string, unknown>;
  onlineMutationFn: (variables: TVariables) => Promise<TData>;
  optimisticUpdate?: (variables: TVariables, tempId?: string) => void;
  onSyncSuccess?: (data: TData) => void;
  invalidateKeys?: readonly unknown[][];
}

export function useOfflineMutation<TVariables, TData = unknown>(
  options: OfflineMutationOptions<TVariables, TData>
): UseMutationResult<TData | { offline: true; tempId?: string }, Error, TVariables> & { isOfflineAction: boolean } {
  const [isOfflineAction, setIsOfflineAction] = useState(false);

  const mutation = useMutation<TData | { offline: true; tempId?: string }, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (navigator.onLine) {
        try {
          const result = await options.onlineMutationFn(variables);
          setIsOfflineAction(false);
          return result;
        } catch (err) {
          if (!navigator.onLine) {
            return await enqueueOffline(variables);
          }
          throw err;
        }
      }
      return await enqueueOffline(variables);
    },
    onSuccess: (data, variables) => {
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      if (data && typeof data === 'object' && !('offline' in data) && options.onSyncSuccess) {
        options.onSyncSuccess(data as TData);
      }
    },
  });

  async function enqueueOffline(variables: TVariables): Promise<{ offline: true; tempId?: string }> {
    setIsOfflineAction(true);
    const tempId = options.getTempId?.(variables) || (options.actionType.includes('CREATE') ? generateTempId() : undefined);
    const entityId = options.getEntityId?.(variables);

    await addOutboxAction({
      actionType: options.actionType,
      entityType: options.entityType,
      entityId,
      tempId,
      payload: options.buildPayload(variables),
    });

    if (options.optimisticUpdate) {
      options.optimisticUpdate(variables, tempId);
    }

    return { offline: true, tempId };
  }

  return { ...mutation, isOfflineAction };
}

export function useOfflineCapable(): { isOfflineCapable: boolean } {
  return { isOfflineCapable: true };
}

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getOutboxCount().then(setCount);
    const unsubscribe = syncEngine.subscribe((_status, c) => setCount(c));
    return unsubscribe;
  }, []);

  return count;
}
