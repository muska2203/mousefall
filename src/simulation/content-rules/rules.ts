/**
 * Декларативные контентные правила.
 *
 * Правила хранятся как статические TypeScript-объекты и регистрируются в реестре
 * content-rules/registry.ts. Шаблоны предметов, способностей и статусов ссылаются
 * на них по полю `ruleIds`.
 */

import type {ContentRule, WorldContentRule} from './types';
import {GLOBAL_WORLD_CONTENT_RULES} from './world-rules/global-rules';
import {counterattackDamageRule, counterattackTriggerRule} from './counterattack-rules';

/**
 * Правила, привязанные к источнику (предмет, способность, талант).
 *
 * На данном этапе здесь находятся только пилотные правила. Тестовые правила
 * живут в tests/fixtures/content-rules.ts и подключаются через
 * setWorldContentRulesOverride / overrideContentRulesForTest при необходимости.
 */
export const CONTENT_RULES: readonly ContentRule[] = [
  counterattackTriggerRule,
  counterattackDamageRule,
  {
    id: 'water_applies_wet',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    conditions: [{ type: 'inTileEffect', effectType: 'water' }],
    effect: {
      type: 'applyStatus',
      statusType: 'wet',
      duration: 3,
    },
    target: { type: 'eventSource' },
    priority: 0,
  },
  {
    id: 'water_applies_wet_on_spawn',
    trigger: {
      event: 'TILE_EFFECT_CHANGED',
    },
    conditions: [
      { type: 'eventFieldEquals', field: 'effectType', value: 'water' },
      { type: 'eventFieldEquals', field: 'isNew', value: true },
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'wet',
      duration: 3,
    },
    target: { type: 'allInRadius', radius: 0, center: 'eventPosition' },
    priority: 0,
  },
  {
    id: 'oil_applies_oiled',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    conditions: [{ type: 'inTileEffect', effectType: 'oil' }],
    effect: {
      type: 'applyStatus',
      statusType: 'oiled',
      duration: 3,
    },
    target: { type: 'eventSource' },
    priority: 0,
  },
  {
    id: 'fire_damage_ignites_oil',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    conditions: [
      { type: 'inTileEffect', effectType: 'oil' },
      {
        type: 'not',
        condition: { type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning' },
      },
    ],
    effect: {
      type: 'applyTileEffectStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventTileEffect', effectType: 'oil' },
    priority: 0,
  },
  {
    id: 'fire_tile_damage_ignites_oil',
    trigger: {
      event: 'TILE_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    conditions: [
      { type: 'inTileEffect', effectType: 'oil' },
      {
        type: 'not',
        condition: { type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning' },
      },
    ],
    effect: {
      type: 'applyTileEffectStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventTileEffect', effectType: 'oil' },
    priority: 0,
  },
  {
    id: 'burning_deals_damage_on_entry',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    conditions: [
      { type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning' },
    ],
    effect: {
      type: 'dealDamage',
      amount: 3,
      tags: ['damage.magical.fire'],
    },
    target: { type: 'eventSource' },
    priority: 0,
  },
  {
    id: 'burning_applies_burning',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    conditions: [
      { type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning' },
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventSource' },
    priority: 0,
  },
  {
    id: 'burning_spreads_to_flammable',
    trigger: {
      event: 'TILE_EFFECT_STATUS_TICKED',
    },
    conditions: [
      { type: 'eventFieldEquals', field: 'effectType', value: 'oil' },
      { type: 'eventFieldEquals', field: 'statusType', value: 'burning' },
    ],
    targetConditions: [
      { type: 'inTileEffect', effectType: 'oil' },
      {
        type: 'not',
        condition: { type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'burning' },
      },
    ],
    effect: {
      type: 'applyTileEffectStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: {
      type: 'tilesInRadius',
      radius: 1,
      center: 'eventPosition',
      effectType: 'oil',
    },
    priority: 0,
  },
  {
    id: 'burning_tile_status_applied_deals_damage',
    trigger: {
      event: 'TILE_EFFECT_STATUS_APPLIED',
    },
    conditions: [
      { type: 'eventFieldEquals', field: 'effectType', value: 'oil' },
      { type: 'eventFieldEquals', field: 'statusType', value: 'burning' },
      { type: 'eventFieldEquals', field: 'isNew', value: true },
    ],
    effect: {
      type: 'dealDamage',
      amount: 3,
      tags: ['damage.magical.fire'],
    },
    target: { type: 'allInRadius', radius: 0, center: 'eventPosition' },
    priority: 0,
  },
  {
    id: 'burning_tile_status_applied_applies_burning',
    trigger: {
      event: 'TILE_EFFECT_STATUS_APPLIED',
    },
    conditions: [
      { type: 'eventFieldEquals', field: 'effectType', value: 'oil' },
      { type: 'eventFieldEquals', field: 'statusType', value: 'burning' },
      { type: 'eventFieldEquals', field: 'isNew', value: true },
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'allInRadius', radius: 0, center: 'eventPosition' },
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
    target: {type: 'eventTarget'},
    priority: 0,
  },
  // ── Стартовые правила оружия (WP6.3) ──────────────────────────────────────
  {
    id: 'weapon_poison_on_hit',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {
        type: 'or',
        conditions: [
          {type: 'hasTag', tag: 'damage.physical.piercing'},
          {type: 'hasTag', tag: 'damage.physical.slashing'},
        ],
      },
      { type: 'eventRole', role: 'source' },
      {type: 'chance', probability: 40},
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'poisoned',
      duration: 3,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    id: 'weapon_blunt_daze',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.physical.blunt', 'delivery.weapon'],
    },
    conditions: [{type: 'chance', probability: 25}],
    effect: {
      type: 'applyStatus',
      statusType: 'dazed',
      duration: 1,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  // ── Стартовые правила брони/щита (WP6.3) ───────────────────────────────────
  {
    id: 'armor_spiked_thorns',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['attack.melee'],
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'dealDamage',
      amount: 2,
      tags: ['damage.physical.piercing'],
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  // ── Стартовые правила колец/амулетов (WP6.3) ───────────────────────────────
  {
    id: 'amulet_restore_ap_on_hit',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['attack.melee', 'delivery.weapon'],
    },
    conditions: [{type: 'chance', probability: 15}],
    effect: {
      type: 'restoreAp',
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    id: 'amulet_fire_damage_multiplier',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.magical.fire'],
    },
    conditions: [
      {
        type: 'or',
        conditions: [
          {type: 'hasTag', tag: 'delivery.weapon'},
          {type: 'hasTag', tag: 'delivery.ability'},
        ],
      },
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 2,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  // ── Стартовые правила статусов (WP6.3) ─────────────────────────────────────
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
  },
  // ── Правила точек интереса (фаза 4 слоистой модели клетки) ─────────────────
  // Правило собирается из ruleIds шаблона poi на клетке события (слой object),
  // поэтому срабатывает только при активации соответствующей точки интереса.
  // Разовость обеспечивает исполнитель ACTIVATE_POI (charges), правило остаётся
  // декларативным по эффекту.
  {
    id: 'altar_heals_player',
    trigger: {
      event: 'POI_USED',
    },
    effect: {
      type: 'heal',
      amount: 25,
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  // ── Правила ловушек (фаза 5 слоистой модели клетки) ────────────────────────
  // Владелец правила — ловушка на клетке события (слой object), поэтому правило
  // срабатывает только при входе сущности на клетку с этой ловушкой.
  // Урон получает вошедший (игрок или враг) — target eventSource.
  // Уничтожение одноразовой ловушки / раскрытие постоянной — процедурные
  // (DESTROY_OBJECT / REVEAL_OBJECT из lifecycle-хука), правило остаётся
  // декларативным по эффекту.
  {
    id: 'spikes_deal_damage',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    effect: {
      type: 'dealDamage',
      amount: 10,
      tags: ['damage.physical.piercing'],
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
];

/**
 * Глобальные мировые контентные правила.
 *
 * Реэкспорт из выделенного модуля `world-rules/global-rules`.
 * Внутри слоя `world` они имеют подтип `worldLayer: 'global'`.
 */
export const WORLD_CONTENT_RULES: readonly WorldContentRule[] = GLOBAL_WORLD_CONTENT_RULES;

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
