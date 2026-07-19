import {ruContentTexts} from './ru/index';
import {enContentTexts} from './en/index';
import type {ContentText, ContentTexts} from './types';

export type Locale = 'ru' | 'en';

const textsByLocale: Record<Locale, ContentTexts> = {
  ru: ruContentTexts,
  en: enContentTexts,
};

export function getTagText(tag: string, locale: Locale): ContentText {
  return getContentText('tags', tag, locale);
}

export function getContentText(
  category: keyof ContentTexts,
  id: string,
  locale: Locale,
): ContentText {
  const safeLocale = (locale === 'en' ? 'en' : 'ru') as Locale;
  const dict = textsByLocale[safeLocale][category];
  const fallback = textsByLocale['ru'][category];
  return dict[id] ?? fallback[id] ?? { name: `[${id}]` };
}
