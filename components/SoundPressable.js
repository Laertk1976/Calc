import { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { useTapSound } from './TapSoundProvider';

export default forwardRef(function SoundPressable({ onPress, onLongPress, silent = false, disabled, ...props }, ref) {
  const { playTapSound } = useTapSound();
  // A scroll can start over a button; only confirmed actions should click.
  const withSound = handler => handler ? event => {
    if (disabled) return;
    if (!silent) playTapSound();
    return handler(event);
  } : undefined;
  return <Pressable {...props} ref={ref} disabled={disabled} android_disableSound
    onPress={withSound(onPress)} onLongPress={withSound(onLongPress)} />;
});
