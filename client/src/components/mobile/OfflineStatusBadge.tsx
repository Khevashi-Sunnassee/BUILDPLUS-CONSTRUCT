import { useState, useCallback } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, ChevronDown, AlertCircle, Check } from 'lucide-react';
import { useOnlineStatus } from '@/lib/offline/hooks';
import { getOutboxActions } from '@/lib/offline/store';
import { getActionDescription } from '@/lib/offline/action-types';
import type { OutboxAction } from '@/lib/offline/db';

export function OfflineStatusBadge() {
  const { isOnline, syncStatus, pendingCount, triggerSync } = useOnlineStatus();
  const [expanded, setExpanded] = useState(false);
  const [actions, setActions] = useState<OutboxAction[]>([]);

  const handleExpand = useCallback(async () => {
    if (!expanded) {
      const allActions = await getOutboxActions();
      setActions(allActions.filter(a => a.status !== 'synced'));
    }
    setExpanded(!expanded);
  }, [expanded]);

  if (isOnline && pendingCount === 0 && syncStatus === 'idle') {
    return null;
  }

  const getBadgeConfig = () => {
    if (!isOnline) {
      return {
        bg: 'bg-red-500/90',
        icon: <WifiOff className="h-3.5 w-3.5" />,
        text: 'Offline',
        dotColor: 'bg-red-400',
      };
    }
    if (syncStatus === 'syncing') {
      return {
        bg: 'bg-yellow-500/90',
        icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
        text: `Syncing${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
        dotColor: 'bg-yellow-400',
      };
    }
    if (syncStatus === 'error' || pendingCount > 0) {
      return {
        bg: 'bg-orange-500/90',
        icon: <CloudOff className="h-3.5 w-3.5" />,
        text: `${pendingCount} pending`,
        dotColor: 'bg-orange-400',
      };
    }
    return {
      bg: 'bg-green-500/90',
      icon: <Cloud className="h-3.5 w-3.5" />,
      text: 'Synced',
      dotColor: 'bg-green-400',
    };
  };

  const config = getBadgeConfig();

  return (
    <div className="fixed top-2 right-2 z-50" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <button
        onClick={handleExpand}
        className={`${config.bg} text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium shadow-lg backdrop-blur-sm`}
        data-testid="button-offline-status"
      >
        {config.icon}
        <span>{config.text}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-1 bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-w-72 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm font-medium text-white">
                  {isOnline ? 'Connected' : 'No Connection'}
                </span>
              </div>
              {isOnline && pendingCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); triggerSync(); }}
                  className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md hover:bg-blue-500/30 flex items-center gap-1"
                  data-testid="button-retry-sync"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          </div>

          {actions.length === 0 ? (
            <div className="p-3 text-center">
              <Check className="h-5 w-5 text-green-400 mx-auto mb-1" />
              <p className="text-xs text-white/60">All changes synced</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {actions.slice(0, 20).map((action) => (
                <div key={action.actionId} className="p-2.5 flex items-start gap-2">
                  <div className="mt-0.5">
                    {action.status === 'failed' ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    ) : action.status === 'syncing' ? (
                      <RefreshCw className="h-3.5 w-3.5 text-yellow-400 animate-spin" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 truncate">
                      {getActionDescription(action.actionType, action.payload)}
                    </p>
                    {action.lastError && (
                      <p className="text-xs text-red-400/80 truncate mt-0.5">
                        {action.lastError}
                      </p>
                    )}
                    <p className="text-xs text-white/30 mt-0.5">
                      {new Date(action.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isOnline && (
            <div className="p-3 border-t border-white/10 bg-red-500/5">
              <p className="text-xs text-white/60 text-center">
                Changes will sync when connection is restored
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
