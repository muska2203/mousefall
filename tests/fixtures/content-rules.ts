/**
 * Тестовые контентные правила и хелперы для их подключения.
 *
 * Правила из этого файла не попадают в production-реестр
 * `src/simulation/content-rules/rules.ts` и используются только в тестах
 * через `withWorldContentRules` / `withContentRules`.
 */

import type {
  ContentRule,
  WorldContentRule,
} from '../../src/simulation/content-rules/types';
import {
  getWorldContentRules,
  setWorldContentRulesOverride,
} from '../../src/simulation/content-rules/rules';
import {
  getAllContentRules,
  setContentRulesOverride,
} from '../../src/simulation/content-rules/registry';

export {getWorldContentRules, setWorldContentRulesOverride};
export {setContentRulesOverride, getAllContentRules};

/** Тестовое правило источника/способности для проверки жизненного цикла. */
export const testSlashingBleedRule: ContentRule = {
  id: 'slashing_weapon_bleed',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['damage.physical.slashing'],
  },
  effect: {
    type: 'applyStatus',
    statusType: 'poisoned',
    duration: 3,
  },
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Тестовое глобальное мировое правило-множитель урона. */
export const testWorldDamageMultiplier: WorldContentRule = {
  id: 'world_global_damage_multiply',
  trigger: {
    event: 'DAMAGE',
  },
  effect: {
    type: 'modifyDamage',
    op: 'multiply',
    value: 1.1,
  },
  target: {type: 'eventTarget'},
  priority: 0,
  ownerContext: {type: 'world'},
  worldLayer: 'global',
};

/** Тестовое глобальное мировое правило, добавляющее тег к урону. */
export const testWorldAddTag: WorldContentRule = {
  id: 'world_global_damage_add_tag',
  trigger: {
    event: 'DAMAGE',
  },
  effect: {
    type: 'modifyDamage',
    op: 'add',
    value: 0,
    addTags: ['layer.world'],
  },
  target: {type: 'eventTarget'},
  priority: 0,
  ownerContext: {type: 'world'},
  worldLayer: 'global',
};

/** Тестовое правило статуса: владелец восстанавливает AP при получении урона. */
export const testStatusRestoreAp: ContentRule = {
  id: 'status_restore_ap_on_damage',
  trigger: {
    event: 'ENTITY_DAMAGED',
  },
  effect: {
    type: 'restoreAp',
  },
  target: {type: 'self'},
  priority: 0,
};

/** Тестовое правило способности: удваивает огненный урон. */
export const testAbilityFireMultiplier: ContentRule = {
  id: 'ability_fire_multiplier',
  trigger: {
    event: 'DAMAGE',
    tags: ['damage.magical.fire'],
  },
  effect: {
    type: 'modifyDamage',
    op: 'multiply',
    value: 2,
  },
  target: {type: 'eventTarget'},
  priority: 0,
};

/**
 * Временно расширяет набор мировых контентных правил для выполнения колбэка.
 *
 * После выполнения восстанавливает исходный набор правил. Гарантирует,
 * что тестовые правила не «утекают» между тестами.
 */
export function withWorldContentRules<T>(
  extraRules: readonly WorldContentRule[],
  callback: () => T,
): T {
  const original = getWorldContentRules();
  setWorldContentRulesOverride([...original, ...extraRules]);
  try {
    return callback();
  } finally {
    setWorldContentRulesOverride(null);
  }
}

/**
 * Временно расширяет набор source-bound контентных правил для выполнения колбэка.
 *
 * После выполнения восстанавливает исходный набор правил. Гарантирует,
 * что тестовые правила не «утекают» между тестами.
 */
export function withContentRules<T>(
  extraRules: readonly ContentRule[],
  callback: () => T,
): T {
  const original = getAllContentRules();
  setContentRulesOverride([...original, ...extraRules]);
  try {
    return callback();
  } finally {
    setContentRulesOverride(null);
  }
}
