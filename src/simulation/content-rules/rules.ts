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
import {groundSlamDazeRule} from './ground-slam-rules';

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
  groundSlamDazeRule,
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
    // eventRole: 'source' обязателен при «всегда»: иначе владелец дробящего
    // оружия оглушал бы сам себя при ударе по нему.
    conditions: [{type: 'eventRole', role: 'source'}],
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
  // ── Правила реликвий стартового пула (roadmap 0.6) ─────────────────────────
  // Владелец правила — экземпляр реликвии в коллекции игрока (ownerContext
  // {type: 'entity', entityId: instanceId}, регистрация в rebuildActiveRules).
  // Условие eventRole отделяет исходящий урон (source) от входящего (target).
  // `chance` не используется — механики детерминированы (решение 2026-08-04).
  {
    // Плюс «Уголька из-за плиты»: удары оружия становятся огненными.
    id: 'relic_salamander_heart_fire_infusion',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 0,
      addTags: ['damage.magical.fire'],
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: входящий огонь бьёт владельца больнее.
    id: 'relic_salamander_heart_fire_vulnerability',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.magical.fire'],
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.25,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Плюс «Поганочной железы»: удары оружия отравляют цель.
    id: 'relic_venom_gland_poison_on_hit',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon'],
    },
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'applyStatus',
      statusType: 'poisoned',
      duration: 3,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: по неотравленной цели урон оружия меньше.
    id: 'relic_venom_gland_ramp_up',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {
        type: 'not',
        condition: {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
      },
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: -1,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Плюс «Ржавой крови»: атакующий в ближнем бою получает отравление.
    id: 'relic_acid_blood_poison_attacker',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['attack.melee'],
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'applyStatus',
      statusType: 'poisoned',
      duration: 2,
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  {
    // Плюс «Носителя серого мора»: удар по отравленному разносит заразу на врагов рядом.
    id: 'relic_plague_bearer_spread',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'poisoned',
      duration: 2,
    },
    target: {type: 'allInRadius', radius: 1, center: 'eventPosition', faction: 'enemy', excludeSelf: true},
    priority: 0,
  },
  {
    // Минус: при переносе заразы владелец получает отравление сам.
    id: 'relic_plague_bearer_self_poison',
    polarity: 'negative',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'poisoned',
      duration: 1,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Плюс «Ушата грома»: дробящие удары оружия ошеломляют (по образцу weapon_blunt_daze).
    id: 'relic_thunderhead_daze',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.physical.blunt', 'delivery.weapon'],
    },
    // Без eventRole правило срабатывало бы и из target-слоя — дезило бы
    // самого владельца при дробящем ударе по нему.
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'applyStatus',
      statusType: 'dazed',
      duration: 1,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: недробящим оружием урон меньше.
    id: 'relic_thunderhead_clumsy',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {
        type: 'not',
        condition: {type: 'hasTag', tag: 'damage.physical.blunt'},
      },
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: -1,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Плюс «Подлого куся»: больше урона по ослабленным целям.
    id: 'relic_opportunist_bonus',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {
        type: 'or',
        conditions: [
          {type: 'hasStatus', statusType: 'dazed', subject: 'target'},
          {type: 'hasStatus', statusType: 'stunned', subject: 'target'},
          {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
        ],
      },
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 3,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: по полноценному противнику урон меньше.
    id: 'relic_opportunist_hesitant',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {
        type: 'not',
        condition: {
          type: 'or',
          conditions: [
            {type: 'hasStatus', statusType: 'dazed', subject: 'target'},
            {type: 'hasStatus', statusType: 'stunned', subject: 'target'},
            {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
          ],
        },
      },
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: -1,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Плюс «Договора с подвалом»: больше весь исходящий урон (без фильтра тегов).
    id: 'relic_blood_pact_power',
    trigger: {
      event: 'DAMAGE',
    },
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 4,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: больше и входящий урон по владельцу.
    id: 'relic_blood_pact_price',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.25,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Плюс «Азарта свалки»: поднятие предмета лечит владельца.
    id: 'relic_scavenger_heal_on_pickup',
    trigger: {
      event: 'ITEM_PICKED_UP',
    },
    // Лечим владельца только когда он сам поднял предмет (иначе правило
    // сработает из radius-слоя при поднятии предмета любым актором рядом).
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'heal',
      amount: 5,
    },
    target: {type: 'self'},
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
