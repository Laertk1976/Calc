import { Pressable, Text, View } from 'react-native';

export default function SyncStatus({ syncStatus, onRetrySync, compact = false }) {
  return (<View accessibilityLiveRegion="polite" style={{ paddingHorizontal: compact ? 0 : 12, paddingBottom: compact ? 0 : 8 }}>
          <Text style={{ color: syncStatus?.phase === 'synced' ? '#8cdbb0' : '#e1c995', fontSize: 12 }}>
            {syncStatus?.phase === 'local' ? 'Saved on this device' :
              syncStatus?.phase === 'synced' ? 'All changes synced ? ' + new Date(syncStatus.lastSyncedAt).toLocaleTimeString() :
              syncStatus?.phase === 'syncing' ? 'Syncing changes?' :
              syncStatus?.phase === 'checking' ? 'Checking sync?' :
              syncStatus?.phase === 'error' ? 'Sync failed ? ' + (syncStatus.error || 'Changes saved on this device') :
              (syncStatus?.phase === 'offline' ? 'Offline ? ' : '') + 'Saved on this device ? ' + (syncStatus?.pending || 0) + ' changes waiting to sync'}
          </Text>
          {['offline', 'error', 'pending'].includes(syncStatus?.phase) && (
            <Pressable accessibilityRole="button" onPress={onRetrySync} style={{ paddingVertical: 8 }}>
              <Text style={{ color: '#a8caff', fontSize: 13 }}>Retry sync</Text>
            </Pressable>
          )}
        </View>);
}
