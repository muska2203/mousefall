import type {SystemEnemyMapperTranslations} from '@i18n/schema';

export const ruEnemyMapper = {
  damagePiercing: 'Колющий',
  damageSlashing: 'Рубящий',
  damageBlunt: 'Тупой',
  damageFire: 'Огненный',
  damageElectric: 'Электрический',
  damagePoison: 'Ядовитый',
  damageFrost: 'Морозный',
} as const satisfies SystemEnemyMapperTranslations;
