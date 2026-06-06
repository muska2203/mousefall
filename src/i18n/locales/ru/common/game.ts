import type { CommonGameTranslations } from '@i18n/schema';

export const ruCommonGame = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  vitality: 'Выносливость',
  hp: 'HP',
  xp: 'Опыт',
  level: 'Уровень',
} as const satisfies CommonGameTranslations;
