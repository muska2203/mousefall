/**
 * Глобальные мировые контентные правила.
 *
 * Эти правила не привязаны к конкретной сущности и срабатывают от любого
 * подходящего события в мире. Используются для глобальных эффектов, тайловых
 * зон и встроенных механик уровня.
 */

import type {WorldContentRule} from '../types';

/**
 * Глобальные мировые контентные правила, активные в слое `world`
 * с подтипом `worldLayer: 'global'`.
 */
export const GLOBAL_WORLD_CONTENT_RULES: readonly WorldContentRule[] = [
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
    id: 'burning_tick_damage',
    trigger: {
      event: 'STATUS_TICKED',
      tags: ['status.burning'],
    },
    effect: {
      type: 'dealDamage',
      amount: {type: 'context', field: 'eventMaxHp', multiply: 0.1, min: 1, round: true},
      tags: ['damage.magical.fire'],
    },
    target: {type: 'eventTarget'},
    priority: 0,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'status_poison_tick_damage',
    trigger: {
      event: 'STATUS_TICKED',
      tags: ['status.poisoned'],
    },
    effect: {
      type: 'dealDamage',
      amount: {type: 'context', field: 'eventMaxHp', multiply: 0.08, min: 1, round: true},
      tags: ['damage.magical.poison'],
    },
    target: {type: 'eventTarget'},
    priority: 0,
    ownerContext: {type: 'world'},
    worldLayer: 'global',
  },
  {
    id: 'status_burning_vulnerability',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.magical.fire'],
    },
    conditions: [{type: 'hasStatus', statusType: 'burning', subject: 'self'}],
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.2,
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
