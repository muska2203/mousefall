import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ruResources } from './locales/ru';
import { enResources } from './locales/en';

const savedLocale = typeof localStorage !== 'undefined'
  ? localStorage.getItem('mousefall-locale')
  : null;
const defaultLocale = savedLocale === 'en' ? 'en' : 'ru';

i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

for (const [ns, resource] of Object.entries(ruResources)) {
  i18n.addResourceBundle('ru', ns, resource, true, true);
}
for (const [ns, resource] of Object.entries(enResources)) {
  i18n.addResourceBundle('en', ns, resource, true, true);
}

export default i18n;
