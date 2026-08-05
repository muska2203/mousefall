import type {CommonGameTranslations} from '@i18n/schema';

export const enCommonGame = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
  vitality: 'Vitality',
  hp: 'HP',
  ap: 'AP',
} as const satisfies CommonGameTranslations;
