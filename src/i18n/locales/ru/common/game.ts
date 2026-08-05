import type {CommonGameTranslations} from '@i18n/schema';

export const ruCommonGame = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  vitality: 'Выносливость',
  hp: 'HP',
  ap: 'Действия',
} as const satisfies CommonGameTranslations;
