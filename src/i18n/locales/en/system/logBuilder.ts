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
  doorOpened: 'Door opened',
  doorClosed: 'Door closed',
  counterattackTriggered: '{{name}} counterattacks',
  abilityPrepared: '{{name}} is preparing {{ability}}',
  abilityPreparedCancelled: '{{name}} interrupted preparation',
  statusBlocked: '{{name}} did not gain {{status}}: blocked by {{blockedBy}}',
  statusRemoved: '{{name}} lost {{status}}',
  entityCollided: '{{name}} collided',
  entityDisplaced: '{{name}} was pushed',
  entityMissed: '{{attacker}} missed {{target}}',
} as const satisfies SystemLogBuilderTranslations;
