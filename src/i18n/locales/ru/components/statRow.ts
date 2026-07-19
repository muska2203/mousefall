import type {ComponentsStatRowTranslations} from '@i18n/schema';

export const ruStatRow = {
  decreaseAria: 'Уменьшить {{name}}',
  increaseAria: 'Увеличить {{name}}',
} as const satisfies ComponentsStatRowTranslations;
