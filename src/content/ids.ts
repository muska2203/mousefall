/**
 * Замкнутые наборы строковых идентификаторов, на которые ссылаются шаблоны.
 * Единственный источник истины: схемы (z.enum) и реестры simulation
 * типизируются от этих констант.
 */

/** Подтипы оружия (замкнутый набор для ItemTemplate.subtype). */
export const WEAPON_SUBTYPE_IDS = ['sword', 'dagger', 'club', 'staff', 'sling', 'unarmed'] as const;
export type WeaponSubtypeId = typeof WEAPON_SUBTYPE_IDS[number];

/** Подтипы брони (замкнутый набор для ItemTemplate.subtype). */
export const ARMOR_SUBTYPE_IDS = ['light', 'heavy', 'magic'] as const;
export type ArmorSubtypeId = typeof ARMOR_SUBTYPE_IDS[number];

/** Подтипы амулетов (замкнутый набор для ItemTemplate.subtype). */
export const AMULET_SUBTYPE_IDS = ['bead', 'charm', 'talisman'] as const;
export type AmuletSubtypeId = typeof AMULET_SUBTYPE_IDS[number];

/** Все подтипы экипировки: объединение подтипов оружия, брони и амулетов. */
export const EQUIPMENT_SUBTYPE_IDS = [
  ...WEAPON_SUBTYPE_IDS,
  ...ARMOR_SUBTYPE_IDS,
  ...AMULET_SUBTYPE_IDS,
] as const;
export type EquipmentSubtypeId = typeof EQUIPMENT_SUBTYPE_IDS[number];

/** Стратегии ИИ (реализации — src/simulation/ai/*-strategy.ts). */
export const AI_STRATEGY_IDS = ['hunter', 'simple-boss', 'guardian-boss'] as const;
export type AiStrategyId = typeof AI_STRATEGY_IDS[number];

/** Стратегии генерации карты (реализации — src/simulation/systems/map-generation/*-strategy.ts). */
export const MAP_STRATEGY_IDS = ['tree'] as const;
export type MapStrategyId = typeof MAP_STRATEGY_IDS[number];
