import type {SystemStatNamesTranslations} from '@i18n/schema';

/** Локализованные имена характеристик. Зеркальный перевод ru/system/statNames.ts. */
export const enStatNames = {
  damage: 'Damage',
  armor: 'Armor',
  maxHp: 'Max HP',
  critMultiplier: 'Crit multiplier',
  throwRange: 'Throw range',
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intelligence',
  vit: 'Vitality',
} as const satisfies SystemStatNamesTranslations;
