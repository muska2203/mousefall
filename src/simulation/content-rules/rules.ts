/**
 * Декларативные контентные правила.
 *
 * Правила хранятся как статические TypeScript-объекты и регистрируются в реестре
 * content-rules/registry.ts. Шаблоны предметов, способностей и статусов ссылаются
 * на них по полю `ruleIds`.
 */

import type {ContentRule, WorldContentRule} from './types';

/**
 * Правила, привязанные к источнику (предмет, способность, талант).
 *
 * На данном этапе здесь находятся только пилотные правила. Тестовые правила
 * живут в tests/fixtures/content-rules.ts и подключаются через
 * setWorldContentRulesOverride / overrideContentRulesForTest при необходимости.
 */
export const CONTENT_RULES: readonly ContentRule[] = [
  {
    id: 'item_fire_damage_multiplier',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.magical.fire'],
    },
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.5,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
];

/**
 * Глобальные мировые контентные правила.
 *
 * Эти правила не привязаны к конкретной сущности и срабатывают от любого
 * подходящего события в мире. Используются для глобальных эффектов, тайловых
 * зон и встроенных механик уровня.
 */
export const WORLD_CONTENT_RULES: readonly WorldContentRule[] = [
  {
    id: 'fire_damage_ignites',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    conditions: [{type: 'chance', probability: 30}],
    effect: {
      type: 'applyStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: {type: 'eventTarget'},
    priority: 0,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'collision_damage',
    trigger: {
      event: 'ENTITY_COLLIDED',
      tags: ['displacement.push'],
    },
    effect: {
      type: 'dealDamage',
      amount: 5,
      tags: ['delivery.movement', 'damage.physical.blunt'],
    },
    target: {type: 'eventTarget'},
    priority: 0,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'collision_damage_actor',
    trigger: {
      event: 'ENTITY_COLLIDED',
      tags: ['displacement.push', 'collision.actor'],
    },
    effect: {
      type: 'dealDamage',
      amount: 5,
      tags: ['delivery.movement', 'damage.physical.blunt'],
    },
    target: {type: 'collisionTarget'},
    priority: 0,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'collision_daze',
    trigger: {
      event: 'ENTITY_COLLIDED',
      tags: ['displacement.push'],
    },
    effect: {
      type: 'applyStatus',
      statusType: 'dazed',
      duration: 2,
    },
    target: {type: 'eventTarget'},
    priority: 1,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'collision_daze_actor',
    trigger: {
      event: 'ENTITY_COLLIDED',
      tags: ['displacement.push', 'collision.actor'],
    },
    effect: {
      type: 'applyStatus',
      statusType: 'dazed',
      duration: 2,
    },
    target: {type: 'collisionTarget'},
    priority: 1,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
];

/** Переопределение мировых правил, используемое только в тестах. */
let worldContentRulesOverride: readonly WorldContentRule[] | null = null;

/**
 * Возвращает актуальный набор мировых контентных правил.
 *
 * В production всегда возвращает `WORLD_CONTENT_RULES`. В тестах может
 * вернуть переопределённый набор, установленный через
 * `setWorldContentRulesOverride`.
 */
export function getWorldContentRules(): readonly WorldContentRule[] {
  return worldContentRulesOverride ?? WORLD_CONTENT_RULES;
}

/**
 * Устанавливает переопределение мировых контентных правил.
 *
 * Передача `null` сбрасывает переопределение. Используется исключительно
 * в тестах для подключения тестовых мировых правил без загрязнения
 * production-реестра.
 */
export function setWorldContentRulesOverride(
  rules: readonly WorldContentRule[] | null,
): void {
  worldContentRulesOverride = rules;
}
