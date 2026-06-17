import type { CommonGameTranslations } from '@i18n/schema';

export const enCommonGame = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
  vitality: 'Vitality',
  hp: 'HP',
  xp: 'XP',
  ap: 'AP',
  level: 'Level',
} as const satisfies CommonGameTranslations;
