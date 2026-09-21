import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function TableActionsMenu({ open, onToggle, onDismiss, actions }) {
  const { t } = useTranslation();
  const { height, width } = useWindowDimensions();
  const trigger = useRef(null);
  const [position, setPosition] = useState({ bottom: 120, right: 12, availableHeight: height - 140 });
  return (
    <View style={s.anchor}>
      <Modal transparent statusBarTranslucent visible={open} animationType="fade" onRequestClose={onDismiss}>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Close menu')} onPress={onDismiss}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.15)' }} />
        <View style={[s.menu, { bottom: position.bottom, right: position.right, width: Math.min(250, width - 24), maxHeight: Math.max(80, Math.min(position.availableHeight, height * 0.65)) }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {actions.map(action => (
              <Pressable key={action.id} accessibilityRole="button" disabled={action.disabled}
                accessibilityState={{ disabled: !!action.disabled }}
                onPress={() => { onDismiss(); action.onPress(); }}
                style={({ pressed }) => [s.item, pressed && s.pressed, action.disabled && s.disabled]}>
                <Text style={s.label}>{action.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        </View>
      </Modal>
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={t('Table actions')}
        accessibilityState={{ expanded: open }} onPress={() => {
          trigger.current?.measureInWindow((x, y, buttonWidth) => {
            setPosition({ bottom: height - y + 10, right: Math.max(12, width - x - buttonWidth), availableHeight: y - 24 });
            onToggle();
          });
        }}
        style={({ pressed }) => [s.trigger, pressed && s.pressed]}>
        <Text style={s.icon}>{open ? '×' : '⋮'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  anchor: { alignSelf: 'flex-end', marginBottom: 10, position: 'relative', zIndex: 2 },
  trigger: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  icon: { color: '#ffffff', fontSize: 30, lineHeight: 34 },
  menu: { position: 'absolute', bottom: 58, right: 0, width: 250, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#475569', padding: 6, elevation: 8, overflow: 'hidden' },
  item: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: 6 },
  label: { color: '#f8fafc', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  pressed: { backgroundColor: '#334155' },
  disabled: { opacity: 0.45 },
});
