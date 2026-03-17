import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE } from './constants';
import zhTW from './locales/zh-TW.json';

void i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: zhTW },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
