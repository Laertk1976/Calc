import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';

// Measure the modal window itself: Android may already resize it for the keyboard.
// Only remove the remaining overlap, so the keyboard space is never counted twice.
export default function KeyboardModalFrame({ children, style, onKeyboardVisibilityChange }) {
  const frame = useRef(null);
  const keyboardTop = useRef(Keyboard.metrics?.()?.screenY ?? null);
  const [overlap, setOverlap] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    onKeyboardVisibilityChange?.(keyboardVisible);
  }, [keyboardVisible, onKeyboardVisibilityChange]);
  const measure = useCallback(() => {
    frame.current?.measureInWindow((x, y, width, height) => {
      setOverlap(keyboardTop.current === null ? 0 : Math.max(0, y + height - keyboardTop.current));
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = globalThis.visualViewport;
      const resize = () => {
        const bottom = viewport ? viewport.offsetTop + viewport.height : globalThis.innerHeight;
        const visible = bottom < globalThis.innerHeight - 80;
        keyboardTop.current = visible ? bottom : null;
        setKeyboardVisible(visible);
        measure();
      };
      viewport?.addEventListener('resize', resize);
      viewport?.addEventListener('scroll', resize);
      resize();
      return () => {
        viewport?.removeEventListener('resize', resize);
        viewport?.removeEventListener('scroll', resize);
      };
    }
    const show = (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardVisible(true);
      measure();
    };
    const hide = () => {
      keyboardTop.current = null;
      setKeyboardVisible(false);
      setOverlap(0);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', hide),
      ...(Platform.OS === 'ios' ? [
        Keyboard.addListener('keyboardWillChangeFrame', show),
        Keyboard.addListener('keyboardWillHide', hide),
      ] : []),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [measure]);

  const backgroundColor = StyleSheet.flatten(style)?.backgroundColor;
  return (
    <View ref={frame} collapsable={false} onLayout={measure} style={{ flex: 1, backgroundColor }}>
      <View style={[style, { flex: 1, minHeight: 0, backgroundColor: undefined, marginBottom: overlap },
        keyboardVisible && { justifyContent: 'flex-end', paddingBottom: 0 }]}>
        {children}
      </View>
    </View>
  );
}
