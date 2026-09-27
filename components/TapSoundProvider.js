import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TapSoundContext = createContext({ playTapSound: () => false });
export const useTapSound = () => useContext(TapSoundContext);

export default function TapSoundProvider({ children }) {
  const keypadClick = useAudioPlayer(require('../assets/tap-sound.wav'), { keepAudioSessionActive: true });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const soundRequestRef = useRef(0);
  const soundChangedRef = useRef(false);
  const soundSaveRef = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('calculator.soundEnabled').then(value => {
      if (active && !soundChangedRef.current) {
        soundEnabledRef.current = value !== 'false';
        setSoundEnabled(value !== 'false');
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const toggleSound = enabled => {
    soundChangedRef.current = true;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    if (!enabled) {
      soundRequestRef.current += 1;
      keypadClick.pause();
    }
    soundSaveRef.current = soundSaveRef.current
      .then(() => AsyncStorage.setItem('calculator.soundEnabled', String(enabled)))
      .catch(() => {});
  };
  const lastTap = useRef(-Infinity);
  const playTapSound = () => {
    // Avoid overlapping sounds from rapid button actions.
    const now = Date.now();
    if (now - lastTap.current < 30) return false;
    lastTap.current = now;
    if (!soundEnabledRef.current) return false;
    const request = ++soundRequestRef.current;
    keypadClick.pause();
    void keypadClick.seekTo(0).then(() => {
      if (soundEnabledRef.current && request === soundRequestRef.current) keypadClick.play();
    }).catch(() => {});
    // Playback never blocks the button action.
    return false;
  };
  return <TapSoundContext.Provider value={{ soundEnabled, toggleSound, playTapSound }}>
    <View style={{ flex: 1 }}>{children}</View>
  </TapSoundContext.Provider>;
}
