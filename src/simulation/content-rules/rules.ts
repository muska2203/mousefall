/**
 * Декларативные контентные правила.
 *
 * Правила хранятся как статические TypeScript-объекты и регистрируются в реестре
 * content-rules/registry.ts. Шаблоны предметов, способностей и статусов ссылаются
 * на них по полю `ruleIds`.
 */

import type { ContentRule } from './types';

/**
 * Тестовые правила для фазы 2.1.
 * Пока не подключены к боевому циклу и используются только для проверки реестра
 * и валидации ссылок.
 */
export const CONTENT_RULES: readonly ContentRule[] = [
  {
    id: 'fire_damage_ignites',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    effect: {
      type: 'applyStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventTarget' },
    priority: 0,
  },
  {
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
    target: { type: 'eventTarget' },
    priority: 0,
  },
];
