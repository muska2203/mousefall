import type { SystemLogBuilderTranslations } from '@i18n/schema';

export const enLogBuilder = {
  heroMoved: '{{name}} moved',
  heroAttacked: '{{name}} attacked',
  damageTaken: '{{name}} took {{damage}} damage',
  heroDied: '{{name}} died',
  playerDied: 'Hero died',
  healReceived: '{{name}} restored {{amount}} HP',
  itemUsedLabel: 'item',
  heroUsedItem: 'Hero used {{itemName}}',
  heroNameFallback: 'Hero',
  enemyNameFallback: 'Enemy',
} as const satisfies SystemLogBuilderTranslations;
