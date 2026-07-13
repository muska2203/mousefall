/**
 * Декларативные контентные правила.
 *
 * Правила хранятся как статические TypeScript-объекты и регистрируются в реестре
 * content-rules/registry.ts. Шаблоны предметов, способностей и статусов ссылаются
 * на них по полю `ruleIds`.
 */

import type { ContentRule, WorldContentRule } from './types';

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
    target: { type: 'eventTarget' },
    priority: 0,
  },
  {
    id: 'item_slashing_damage_add',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.physical.slashing'],
    },
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 3,
      addTags: ['damage.bonus'],
    },
    target: { type: 'eventTarget' },
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
    id: 'world_global_fire_bonus',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    effect: {
      type: 'applyStatus',
      statusType: 'burning',
      duration: 1,
    },
    target: { type: 'eventTarget' },
    priority: 0,
    ownerContext: { type: 'world' },
    worldLayer: 'global',
  },
  {
    id: 'world_global_damage_multiply',
    trigger: {
      event: 'DAMAGE',
    },
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.1,
    },
    target: { type: 'eventTarget' },
    priority: 0,
    ownerContext: { type: 'world' },
    worldLayer: 'global',
  },
  {
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
    target: { type: 'eventTarget' },
    priority: 0,
    ownerContext: { type: 'world' },
    worldLayer: 'global',
  },
];
