import { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { useTapSound } from './TapSoundProvider';

export default forwardRef(function SoundPressable({ onPress, onLongPress, silent = false, disabled, ...props }, ref) {
  const { playTapSound } = useTapSound();
  const withSound = handler => handler ? event => {
    if (disabled) return;
    if (!silent) playTapSound();
    handler(event);
  } : undefined;
  return <Pressable {...props} ref={ref} disabled={disabled} android_disableSound
    onPress={withSound(onPress)} onLongPress={withSound(onLongPress)} />;
});
