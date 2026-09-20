import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export default function SyncStatus({ syncStatus, onRetrySync, compact = false }) {
  const { t, i18n } = useTranslation();
  const synced = syncStatus?.phase === 'synced';
  const color = synced ? '#8cdbb0' : '#94a3b8';
  const statusLabel = synced ? t("All changes synced")
    : syncStatus?.phase === 'syncing' ? t("Syncing changes")
    : syncStatus?.phase === 'checking' ? t("Checking sync")
    : syncStatus?.phase === 'error' ? t('Sync failed: {{error}}', { error: syncStatus.error || t('Changes saved on this device') })
    : syncStatus?.phase === 'local' ? t("Saved on this device")
    : `${syncStatus?.phase === 'offline' ? t('Offline') + '. ' : ''}${t('Changes waiting to sync: {{count}}', { count: syncStatus?.pending || 0 })}`;
  const syncedTime = synced && syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString(i18n.resolvedLanguage, {
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
          <Text style={{ color: '#a8caff', fontSize: 13 }}>{t("Retry sync")}</Text>
        </Pressable>
      )}
    </View>
  );
}