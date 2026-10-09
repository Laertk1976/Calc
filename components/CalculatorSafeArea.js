import { useLayoutEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Android can briefly report hidden system bars while restoring an activity.
// Keep the last padding through that transition, but still accept persistent
// changes (for example switching navigation modes or entering multi-window).
function AndroidCalculatorSafeArea({ style, children }) {
  const insets = useSafeAreaInsets();
  const [padding, setPadding] = useState(insets);
  useLayoutEffect(() => {
    const shrinking = insets.top < padding.top || insets.bottom < padding.bottom
      || insets.left < padding.left || insets.right < padding.right;
    if (!shrinking) {
      setPadding(insets);
      return;
    }
    const timer = setTimeout(() => setPadding(insets), 250);
    return () => clearTimeout(timer);
  }, [insets, padding]);
  return <View style={[style, {
    paddingTop: padding.top, paddingBottom: padding.bottom,
    paddingLeft: padding.left, paddingRight: padding.right,
  }]}>{children}</View>;
}

export default Platform.OS === 'android' ? AndroidCalculatorSafeArea : SafeAreaView;
