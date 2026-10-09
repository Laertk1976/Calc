import Pressable from './SoundPressable';
import ButtonLabel from './ButtonLabel';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export default function SyncStatus({ syncStatus, onRetrySync, compact = false, showStatus = false }) {
  const { t, i18n } = useTranslation();
  const rotation = useRef(new Animated.Value(0)).current;
  const turns = useRef(0);
  const busy = syncStatus?.phase === 'syncing';
  const disabled = !onRetrySync || busy || ['local', 'deleting'].includes(syncStatus?.phase);
  useEffect(() => () => rotation.stopAnimation(), [rotation]);
  const manualSync = () => {
    if (disabled) return;
    turns.current += 1;
    Animated.timing(rotation, {
      toValue: turns.current,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    onRetrySync();
  };
  const synced = syncStatus?.phase === 'synced';
  const color = synced ? '#8cdbb0' : '#94a3b8';
  const statusLabel = syncStatus?.deletionPending ? t('Account deletion is pending. Open Account to finish deletion.') : synced ? t("All changes synced")
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
      {showStatus && <Text accessibilityLiveRegion="polite" style={{ color: '#94a3b8', fontSize: 13 }}>{statusLabel}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('Retry sync')}. ${statusLabel}${syncedTime ? `, ${syncedTime}` : ''}`}
          accessibilityState={{ disabled, busy }} accessibilityLiveRegion="polite"
          disabled={disabled} onPress={manualSync} style={{ width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="sync" size={20} color={color} />
          </Animated.View>
        </Pressable>
        {!!syncedTime && <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 12, flexShrink: 1 }}>{syncedTime}</Text>}
      </View>
      {syncStatus?.deletionPending && <Text accessibilityRole="alert" style={{ color: '#fbbf24', fontSize: 12, maxWidth: 240 }}>{t('Account deletion is pending. Open Account to finish deletion.')}</Text>}
      {['offline', 'error', 'pending'].includes(syncStatus?.phase) && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('Retry sync')} disabled={disabled} onPress={manualSync} style={compact ? { height: 36, justifyContent: 'center', minWidth: 0 } : { paddingVertical: 8 }}>
          {compact ? <ButtonLabel numberOfLines={1} style={{ color: '#a8caff', fontSize: 13 }}>{t('Retry sync')}</ButtonLabel>
            : <Text style={{ color: '#a8caff', fontSize: 13 }}>{t('Retry sync')}</Text>}
        </Pressable>
      )}
    </View>
  );
}
