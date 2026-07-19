import type {SystemEnemyMapperTranslations} from '@i18n/schema';

export const enEnemyMapper = {
  damagePiercing: 'Piercing',
  damageSlashing: 'Slashing',
  damageBlunt: 'Blunt',
  damageFire: 'Fire',
  damageElectric: 'Electric',
  damagePoison: 'Poison',
  damageFrost: 'Frost',
} as const satisfies SystemEnemyMapperTranslations;
