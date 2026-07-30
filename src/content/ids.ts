/**
 * Замкнутые наборы строковых идентификаторов, на которые ссылаются шаблоны.
 * Единственный источник истины: схемы (z.enum) и реестры simulation
 * типизируются от этих констант.
 */

/** Формулы урона оружия (реализации — src/simulation/systems/stats/weapon-formulas.ts). */
export const WEAPON_FORMULA_IDS = ['unarmed', 'club', 'dagger', 'staff', 'sword'] as const;
export type WeaponFormulaId = typeof WEAPON_FORMULA_IDS[number];

/** Стратегии ИИ (реализации — src/simulation/ai/*-strategy.ts). */
export const AI_STRATEGY_IDS = ['hunter', 'simple-boss'] as const;
export type AiStrategyId = typeof AI_STRATEGY_IDS[number];

/** Стратегии генерации карты (реализации — src/simulation/systems/map-generation/*-strategy.ts). */
export const MAP_STRATEGY_IDS = ['tree'] as const;
export type MapStrategyId = typeof MAP_STRATEGY_IDS[number];
