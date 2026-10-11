import { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { useTapSound } from './TapSoundProvider';

export default forwardRef(function SoundPressable({ onPress, onPressIn, silent = false, disabled, ...props }, ref) {
  const { playTapSound } = useTapSound();
  const handlePressIn = event => {
    if (!disabled && !silent) playTapSound();
    onPressIn?.(event);
  };
  return <Pressable {...props} ref={ref} disabled={disabled} android_disableSound
    onPress={onPress} onPressIn={handlePressIn} />;
});
