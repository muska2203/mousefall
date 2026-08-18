import type {SystemStatNamesTranslations} from '@i18n/schema';

/** Локализованные имена характеристик (для отображения модификаторов, напр. реликвий). */
export const ruStatNames = {
  damage: 'Урон',
  armor: 'Броня',
  maxHp: 'Макс. здоровье',
  critMultiplier: 'Множитель крита',
  throwRange: 'Дальность броска',
  str: 'Сила',
  dex: 'Ловкость',
  int: 'Интеллект',
  vit: 'Живучесть',
} as const satisfies SystemStatNamesTranslations;
