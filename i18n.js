import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import hy from './locales/hy.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import hi from './locales/hi.json';

export const languages = [
  { code: 'hy', name: 'Հայերեն' },
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'hi', name: 'हिन्दी' },
];
const storageKey = 'calculator.language';
let selectionChanged = false;
let pendingSave = Promise.resolve();
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hy: { translation: hy }, ru: { translation: ru }, ja: { translation: ja }, hi: { translation: hi } },
  lng: 'en', fallbackLng: 'en', supportedLngs: languages.map(({ code }) => code),
  keySeparator: false, nsSeparator: false,
  interpolation: { escapeValue: false },
  initImmediate: false,
  react: { useSuspense: false },
});
AsyncStorage.getItem(storageKey).then(code => {
  if (!selectionChanged && languages.some(language => language.code === code)) void i18n.changeLanguage(code);
}).catch(() => {});

export function selectLanguage(code) {
  if (!languages.some(language => language.code === code)) return;
  selectionChanged = true;
  void i18n.changeLanguage(code);
  pendingSave = pendingSave.then(() => AsyncStorage.setItem(storageKey, code)).catch(() => {});
}
export default i18n;
