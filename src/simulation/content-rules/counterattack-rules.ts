import type { ContentRule } from './types';

/**
 * Контентные правила контратаки.
 *
 * Вариант B: урон рассчитывается в исполнителе интента COUNTER_ATTACK
 * и записывается в событие COUNTER_ATTACK_APPLIED. Контентные правила
 * только запускают контратаку и читают готовый урон из события.
 */

/** Правило, запускающее контратаку при получении ближнего одиночного урона. */
export const counterattackTriggerRule: ContentRule = {
  id: 'counterattack_trigger',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
  conditions: [
    { type: 'hasStatus', statusType: 'counterattack', subject: 'self' },
    // Контратака — реакция на полученный урон, поэтому владелец должен быть целью события.
    { type: 'eventRole', role: 'target' },
    { type: 'chance', probability: 50 },
    { type: 'not', condition: { type: 'hasTag', tag: 'target.aoe' } },
    { type: 'not', condition: { type: 'hasTag', tag: 'target.multi' } },
  ],
  effect: { type: 'counterAttack' },
  target: { type: 'eventSource' },
  priority: 0,
};

/** Правило, наносящее урон из события COUNTER_ATTACK_APPLIED. */
export const counterattackDamageRule: ContentRule = {
  id: 'counterattack_damage',
  trigger: {
    event: 'COUNTER_ATTACK_APPLIED',
  },
  effect: {
    type: 'dealDamage',
    amount: { type: 'context', field: 'eventDamage' },
    // Теги урона наследуются из события COUNTER_ATTACK_APPLIED.
  },
  target: { type: 'eventTarget' },
  priority: 0,
};
