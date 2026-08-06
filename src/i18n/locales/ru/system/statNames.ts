import type {SystemStatNamesTranslations} from '@i18n/schema';

/** Локализованные имена характеристик (для отображения модификаторов, напр. реликвий). */
export const ruStatNames = {
  damage: 'Урон',
  armor: 'Броня',
  maxHp: 'Макс. здоровье',
  dodgeChance: 'Уклонение',
  accuracy: 'Точность',
  critChance: 'Шанс крита',
  critMultiplier: 'Множитель крита',
  str: 'Сила',
  dex: 'Ловкость',
  int: 'Интеллект',
  vit: 'Живучесть',
} as const satisfies SystemStatNamesTranslations;
