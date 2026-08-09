/**
 * Синтетические шаблоны и правила тайловых эффектов для интеграционных тестов.
 *
 * Числа намеренно не совпадают с реальным балансом (src/content/templates/tile-effects,
 * src/simulation/content-rules/rules.ts): тесты assert'ят значения из этого файла,
 * поэтому балансные правки реального контента их не ломают.
 *
 * Структура шаблонов и правил повторяет реальную (те же условия и цели),
 * но с тестовыми id — реальные правила масла/воды/горения в тестах не участвуют.
 */

import type {
  ItemTemplate,
  StatusTemplate,
  TileEffectStatusTemplate,
  TileEffectTemplate,
} from '../../src/content/schemas';
import type {ContentRule} from '../../src/simulation/content-rules/types';
import {setContentRulesOverride} from '../../src/simulation/content-rules/registry';
import {initObjectContentRegistry} from './gameState';

// ─────────────────────────────────────────────
// Тестовые числа (не совпадают с реальным балансом)
// ─────────────────────────────────────────────

/** Базовая длительность масла из шаблона. */
export const TEST_OIL_DURATION = 6;
/** Базовая длительность воды из шаблона. */
export const TEST_WATER_DURATION = 7;
/** Длительность статуса burning на масле при поджоге (из тестового правила поджога). */
export const TEST_IGNITE_DURATION = 2;
/** Базовая длительность статуса burning в шаблоне (статус neverExpires — не тикает). */
export const TEST_BURNING_TILE_STATUS_DURATION = 2;
/** Урон актора при входе на горящее масло. */
export const TEST_BURNING_ENTRY_DAMAGE = 4;
/** Длительность статуса burning на акторе при входе на горящее масло. */
export const TEST_BURNING_ENTRY_STATUS_DURATION = 2;
/** Урон существам на клетке при наложении burning на масло. */
export const TEST_BURNING_APPLIED_DAMAGE = 4;
/** Длительность burning на существах при наложении burning на масло. */
export const TEST_BURNING_APPLIED_STATUS_DURATION = 2;
/** Длительность статуса oiled. */
export const TEST_OILED_DURATION = 2;
/** Длительность статуса wet. */
export const TEST_WET_DURATION = 2;

// ─────────────────────────────────────────────
// Синтетические шаблоны
// ─────────────────────────────────────────────

/** Шаблоны тайловых эффектов: масло (горит, гасит себя) и вода (тушит). */
export function createTestTileEffectTemplates(): Map<string, TileEffectTemplate> {
  return new Map([
    ['oil', {
      id: 'oil',
      layer: 'cover',
      duration: TEST_OIL_DURATION,
      renderOrder: 2,
      ruleIds: [
        'test_oil_applies_oiled',
        'test_fire_damage_ignites_oil',
        'test_fire_tile_damage_ignites_oil',
      ],
      canHaveStatus: ['burning'],
      durationDecreasesWhenHasStatus: ['burning'],
      blocksLOS: false,
    }],
    ['water', {
      id: 'water',
      layer: 'cover',
      duration: TEST_WATER_DURATION,
      renderOrder: 1,
      ruleIds: ['test_water_applies_wet', 'test_water_applies_wet_on_spawn'],
      canHaveStatus: [],
      durationDecreasesWhenHasStatus: [],
      blocksLOS: false,
    }],
  ]);
}

/** Шаблон статуса burning тайлового эффекта (neverExpires, как реальный). */
export function createTestTileEffectStatusTemplates(): Map<string, TileEffectStatusTemplate> {
  return new Map([
    ['burning', {
      id: 'burning',
      duration: TEST_BURNING_TILE_STATUS_DURATION,
      neverExpires: true,
      ruleIds: [
        'test_burning_spreads_to_flammable',
        'test_burning_deals_damage_on_entry',
        'test_burning_applies_burning',
        'test_burning_status_applied_deals_damage',
        'test_burning_status_applied_applies_burning',
      ],
      statusCategory: 'elemental',
      categoryPriority: 1,
      mutuallyExclusiveWith: [],
      blockedBy: [],
      renderOrder: 10,
    }],
  ]);
}

/**
 * Шаблоны статусов сущностей (oiled/wet/burning).
 *
 * Нужны resolveStatusBatch: без шаблонов все статусы падают в категорию
 * 'generic' с нулевым приоритетом, и одновременно наложенные oiled + burning
 * схлопываются в один интент. Категории/приоритеты повторяют форму реальных
 * шаблонов, но заданы здесь — тест не зависит от src/content/templates/statuses.
 */
export function createTestStatusTemplates(): Map<string, StatusTemplate> {
  return new Map([
    ['oiled', {
      id: 'oiled',
      ruleIds: [],
      statusCategory: 'elemental',
      categoryPriority: 0,
      mutuallyExclusiveWith: ['wet'],
      blockedBy: [],
    }],
    ['wet', {
      id: 'wet',
      ruleIds: [],
      statusCategory: 'elemental',
      categoryPriority: 0,
      mutuallyExclusiveWith: ['burning', 'oiled'],
      blockedBy: [],
    }],
    ['burning', {
      id: 'burning',
      ruleIds: [],
      statusCategory: 'elemental',
      categoryPriority: 1,
      mutuallyExclusiveWith: ['frozen'],
      blockedBy: [],
    }],
  ]);
}

/** Расходники water_ball / oil_bottle с механикой spawn_tile_effect. */
export function createTestConsumableTemplates(): Map<string, ItemTemplate> {
  const consumable = (
    id: string,
    tileEffectType: string,
  ): ItemTemplate => ({
    id,
    type: 'consumable',
    rarity: 'common',
    stackable: true,
    maxStack: 5,
    value: 0,
    consumable: {effect: 'spawn_tile_effect', tileEffectType, radius: 1, range: 5},
    fixedModifiers: [],
    abilityPool: [],
    grantedAbilities: [],
    apCost: 1,
  });
  return new Map([
    ['water_ball', consumable('water_ball', 'water')],
    ['oil_bottle', consumable('oil_bottle', 'oil')],
  ]);
}

// ─────────────────────────────────────────────
// Тестовые правила (повторяют форму реальных oil/water/burning-правил)
// ─────────────────────────────────────────────

/** Масло накладывает oiled на вошедшего актора. */
const testOilAppliesOiled: ContentRule = {
  id: 'test_oil_applies_oiled',
  trigger: {event: 'ENTITY_MOVED'},
  conditions: [{type: 'inTileEffect', effectType: 'oil'}],
  effect: {type: 'applyStatus', statusType: 'oiled', duration: TEST_OILED_DURATION},
  target: {type: 'eventSource'},
  priority: 0,
};

/** Вода накладывает wet на вошедшего актора. */
const testWaterAppliesWet: ContentRule = {
  id: 'test_water_applies_wet',
  trigger: {event: 'ENTITY_MOVED'},
  conditions: [{type: 'inTileEffect', effectType: 'water'}],
  effect: {type: 'applyStatus', statusType: 'wet', duration: TEST_WET_DURATION},
  target: {type: 'eventSource'},
  priority: 0,
};

/** Вода накладывает wet на существ клетки при появлении. */
const testWaterAppliesWetOnSpawn: ContentRule = {
  id: 'test_water_applies_wet_on_spawn',
  trigger: {event: 'TILE_EFFECT_CHANGED'},
  conditions: [
    {type: 'eventFieldEquals', field: 'effectType', value: 'water'},
    {type: 'eventFieldEquals', field: 'isNew', value: true},
  ],
  effect: {type: 'applyStatus', statusType: 'wet', duration: TEST_WET_DURATION},
  target: {type: 'allInRadius', radius: 0, center: 'eventPosition'},
  priority: 0,
};

/** Огненный урон по сущности на масле поджигает масло. */
const testFireDamageIgnitesOil: ContentRule = {
  id: 'test_fire_damage_ignites_oil',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire']},
  conditions: [
    {type: 'inTileEffect', effectType: 'oil'},
    {type: 'not', condition: {type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning'}},
  ],
  effect: {type: 'applyTileEffectStatus', statusType: 'burning', duration: TEST_IGNITE_DURATION},
  target: {type: 'eventTileEffect', effectType: 'oil'},
  priority: 0,
};

/** Площадной огненный урон по клетке поджигает масло. */
const testFireTileDamageIgnitesOil: ContentRule = {
  id: 'test_fire_tile_damage_ignites_oil',
  trigger: {event: 'TILE_DAMAGED', tags: ['damage.magical.fire']},
  conditions: [
    {type: 'inTileEffect', effectType: 'oil'},
    {type: 'not', condition: {type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning'}},
  ],
  effect: {type: 'applyTileEffectStatus', statusType: 'burning', duration: TEST_IGNITE_DURATION},
  target: {type: 'eventTileEffect', effectType: 'oil'},
  priority: 0,
};

/** Вход на горящее масло наносит урон актору. */
const testBurningDealsDamageOnEntry: ContentRule = {
  id: 'test_burning_deals_damage_on_entry',
  trigger: {event: 'ENTITY_MOVED'},
  conditions: [{type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning'}],
  effect: {type: 'dealDamage', amount: TEST_BURNING_ENTRY_DAMAGE, tags: ['damage.magical.fire']},
  target: {type: 'eventSource'},
  priority: 0,
};

/** Вход на горящее масло накладывает burning на актора. */
const testBurningAppliesBurning: ContentRule = {
  id: 'test_burning_applies_burning',
  trigger: {event: 'ENTITY_MOVED'},
  conditions: [{type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning'}],
  effect: {type: 'applyStatus', statusType: 'burning', duration: TEST_BURNING_ENTRY_STATUS_DURATION},
  target: {type: 'eventSource'},
  priority: 0,
};

/** Тик горения распространяет burning на соседнее масло. */
const testBurningSpreadsToFlammable: ContentRule = {
  id: 'test_burning_spreads_to_flammable',
  trigger: {event: 'TILE_EFFECT_STATUS_TICKED'},
  conditions: [
    {type: 'eventFieldEquals', field: 'effectType', value: 'oil'},
    {type: 'eventFieldEquals', field: 'statusType', value: 'burning'},
  ],
  targetConditions: [
    {type: 'inTileEffect', effectType: 'oil'},
    {type: 'not', condition: {type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning'}},
  ],
  effect: {type: 'applyTileEffectStatus', statusType: 'burning', duration: TEST_IGNITE_DURATION},
  target: {type: 'tilesInRadius', radius: 1, center: 'eventPosition', effectType: 'oil'},
  priority: 0,
};

/** Наложение burning на масло наносит урон существам на клетке. */
const testBurningStatusAppliedDealsDamage: ContentRule = {
  id: 'test_burning_status_applied_deals_damage',
  trigger: {event: 'TILE_EFFECT_STATUS_APPLIED'},
  conditions: [
    {type: 'eventFieldEquals', field: 'effectType', value: 'oil'},
    {type: 'eventFieldEquals', field: 'statusType', value: 'burning'},
    {type: 'eventFieldEquals', field: 'isNew', value: true},
  ],
  effect: {type: 'dealDamage', amount: TEST_BURNING_APPLIED_DAMAGE, tags: ['damage.magical.fire']},
  target: {type: 'allInRadius', radius: 0, center: 'eventPosition'},
  priority: 0,
};

/** Наложение burning на масло накладывает burning на существ на клетке. */
const testBurningStatusAppliedAppliesBurning: ContentRule = {
  id: 'test_burning_status_applied_applies_burning',
  trigger: {event: 'TILE_EFFECT_STATUS_APPLIED'},
  conditions: [
    {type: 'eventFieldEquals', field: 'effectType', value: 'oil'},
    {type: 'eventFieldEquals', field: 'statusType', value: 'burning'},
    {type: 'eventFieldEquals', field: 'isNew', value: true},
  ],
  effect: {type: 'applyStatus', statusType: 'burning', duration: TEST_BURNING_APPLIED_STATUS_DURATION},
  target: {type: 'allInRadius', radius: 0, center: 'eventPosition'},
  priority: 0,
};

/** Все тестовые правила тайловых эффектов. */
export const testTileEffectRules: readonly ContentRule[] = [
  testOilAppliesOiled,
  testWaterAppliesWet,
  testWaterAppliesWetOnSpawn,
  testFireDamageIgnitesOil,
  testFireTileDamageIgnitesOil,
  testBurningDealsDamageOnEntry,
  testBurningAppliesBurning,
  testBurningSpreadsToFlammable,
  testBurningStatusAppliedDealsDamage,
  testBurningStatusAppliedAppliesBurning,
];

/**
 * Поднимает реестр контента с синтетическими шаблонами тайловых эффектов
 * и подключает тестовые правила. Реальный контент не загружается.
 *
 * После теста вызывать `resetTileEffectTestContent()`.
 */
export function initTileEffectTestContent(options: {withConsumables?: boolean} = {}): void {
  initObjectContentRegistry({
    tileEffects: createTestTileEffectTemplates(),
    tileEffectStatuses: createTestTileEffectStatusTemplates(),
    statuses: createTestStatusTemplates(),
    ...(options.withConsumables ? {items: createTestConsumableTemplates()} : {}),
  });
  setContentRulesOverride([...testTileEffectRules]);
}

/** Снимает переопределение контентных правил после теста. */
export function resetTileEffectTestContent(): void {
  setContentRulesOverride(null);
}
