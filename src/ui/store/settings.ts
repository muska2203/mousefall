import { create } from 'zustand';
import i18next from 'i18next';
import type { Locale } from '@content/texts/lookup';

interface SettingsState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  locale: (localStorage.getItem('mousefall-locale') as Locale) ?? 'ru',
  setLocale: (locale) => {
    localStorage.setItem('mousefall-locale', locale);
    i18next.changeLanguage(locale);
    set({ locale });
  },
}));
