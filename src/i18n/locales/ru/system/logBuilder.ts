import type { SystemLogBuilderTranslations } from '@i18n/schema';

export const ruLogBuilder = {
  heroMoved: '{{name}} переместился',
  heroAttacked: '{{name}} атаковал',
  damageTaken: '{{name}} получил {{damage}} урона',
  heroDied: '{{name}} погиб',
  playerDied: 'Герой погиб',
  healReceived: '{{name}} восстановил {{amount}} HP',
  itemUsedLabel: 'предмет',
  heroUsedItem: 'Герой использовал {{itemName}}',
  heroNameFallback: 'Герой',
  enemyNameFallback: 'Враг',
  doorOpened: 'Дверь открыта',
  doorClosed: 'Дверь закрыта',
  counterattackTriggered: '{{name}} контратакует',
} as const satisfies SystemLogBuilderTranslations;
