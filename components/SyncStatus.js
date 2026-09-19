import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export default function SyncStatus({ syncStatus, onRetrySync, compact = false }) {
  const synced = syncStatus?.phase === 'synced';
  const color = synced ? '#8cdbb0' : '#94a3b8';
  const statusLabel = synced ? 'All changes synced'
    : syncStatus?.phase === 'syncing' ? 'Syncing changes'
    : syncStatus?.phase === 'checking' ? 'Checking sync'
    : syncStatus?.phase === 'error' ? `Sync failed: ${syncStatus.error || 'Changes saved on this device'}`
    : syncStatus?.phase === 'local' ? 'Saved on this device'
    : `${syncStatus?.phase === 'offline' ? 'Offline. ' : ''}${syncStatus?.pending || 0} changes waiting to sync`;
  const syncedTime = synced && syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }) : '';

  return (
    <View style={{ paddingHorizontal: compact ? 0 : 12, paddingBottom: compact ? 0 : 8 }}>
      <View accessible accessibilityRole="text" accessibilityLiveRegion="polite"
        accessibilityLabel={`${statusLabel}${syncedTime ? `, ${syncedTime}` : ''}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="sync" size={20} color={color} />
        {!!syncedTime && <Text style={{ color, fontSize: 12 }}>{syncedTime}</Text>}
      </View>
      {['offline', 'error', 'pending'].includes(syncStatus?.phase) && (
        <Pressable accessibilityRole="button" onPress={onRetrySync} style={{ paddingVertical: 8 }}>
          <Text style={{ color: '#a8caff', fontSize: 13 }}>Retry sync</Text>
        </Pressable>
      )}
    </View>
  );
}