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
  // Кровавая лужа (кровавая ветка, §4.3): bleed вешается напрямую,
  // без статуса-маркера — повторный заход просто обновит длительность до 2.
  {
    id: 'blood_puddle_applies_bleeding',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    conditions: [{ type: 'inTileEffect', effectType: 'blood_puddle' }],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 2,
    },
    target: { type: 'eventSource' },
    priority: 0,
  },
  {
    id: 'blood_puddle_applies_bleeding_on_spawn',
    trigger: {
      event: 'TILE_EFFECT_CHANGED',
    },
    conditions: [
      { type: 'eventFieldEquals', field: 'effectType', value: 'blood_puddle' },
      { type: 'eventFieldEquals', field: 'isNew', value: true },
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 2,
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
  // ── Поджог взвешанной муки (копии масляных правил выше, effectType flour_cloud).
  // Взрыв — не здесь: обобщённая мировая реакция читает explosion из шаблона.
  {
    id: 'fire_damage_ignites_flour',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    conditions: [
      { type: 'inTileEffect', effectType: 'flour_cloud' },
      {
        type: 'not',
        condition: { type: 'tileEffectHasStatus', effectType: 'flour_cloud', statusType: 'burning' },
      },
    ],
    effect: {
      type: 'applyTileEffectStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventTileEffect', effectType: 'flour_cloud' },
    priority: 0,
  },
  {
    id: 'fire_tile_damage_ignites_flour',
    trigger: {
      event: 'TILE_DAMAGED',
      tags: ['damage.magical.fire'],
    },
    conditions: [
      { type: 'inTileEffect', effectType: 'flour_cloud' },
      {
        type: 'not',
        condition: { type: 'tileEffectHasStatus', effectType: 'flour_cloud', statusType: 'burning' },
      },
    ],
    effect: {
      type: 'applyTileEffectStatus',
      statusType: 'burning',
      duration: 3,
    },
    target: { type: 'eventTileEffect', effectType: 'flour_cloud' },
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
    // eventRole: 'source' обязателен: иначе копия правила соседнего владельца
    // подхватывается слоем radius и модифицирует урон повторно.
    conditions: [{type: 'eventRole', role: 'source'}],
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
  {
    // Кровотечение при ударе — фирменное свойство мечей (концепт этажа 1, §4.3).
    id: 'weapon_bleeding_on_hit',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    },
    // eventRole: 'source' обязателен: иначе владелец рубящего оружия
    // открывал бы кровотечение у самого себя при ударе по нему.
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 3,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Добивание по кровоточащим — pool-аффикс мечей (roadmap этажа 1, п. 2.1).
    id: 'weapon_bleeding_execute',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    // eventRole: 'source' обязателен: иначе копия правила соседнего владельца
    // подхватывается слоем radius и модифицирует урон повторно.
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
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
    // «Рваные края»: удар по уже кровоточащей цели продлевает рану до 5 ходов
    // (план docs/plans/bleed-builds-implementation.md, этап 2, решение §1 п. 6).
    // Условие hasStatus отсекает свежие цели, чтобы не дублировать
    // weapon_bleeding_on_hit. eventRole: 'source' обязателен — защита от
    // повторного срабатывания копии правила из слоёв target/radius.
    id: 'weapon_bleeding_widening',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 5,
    },
    target: {type: 'eventTarget'},
    // priority выше, чем у weapon_bleeding_on_hit (0): applyStatus на висящем
    // статусе перезаписывает duration, поэтому «Рваные края» обязаны исполниться
    // ПОСЛЕДНИМИ — иначе on-hit перезаписал бы продление до 5 обратно на 3.
    priority: 1,
  },
  // ── Стартовые правила брони/щита (WP6.3) ───────────────────────────────────
  {
    id: 'armor_spiked_thorns',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['attack.melee'],
    },
    // notSelfHit обязателен: самоурон владельца (например, собственный Налёт
    // до исправления excludeEntityId и любые будущие self-hit'ы с attack.melee)
    // не должен разворачивать шипы против самого владельца.
    conditions: [{type: 'eventRole', role: 'target'}, {type: 'notSelfHit'}],
    effect: {
      type: 'dealDamage',
      amount: 2,
      tags: ['damage.physical.piercing'],
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  {
    // «Кровавые шипы»: при получении урона в ближнем бою открывает кровотечение
    // у нападающего (план docs/plans/bleed-builds-implementation.md, этап 2).
    // notSelfHit обязателен по образцу armor_spiked_thorns: самоурон владельца
    // с тегом attack.melee не должен вешать кровотечение на самого владельца.
    id: 'armor_bleeding_thorns',
    trigger: {
      event: 'ENTITY_DAMAGED',
      tags: ['attack.melee'],
    },
    conditions: [{type: 'eventRole', role: 'target'}, {type: 'notSelfHit'}],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 2,
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
    // eventRole: 'source' обязателен: иначе копия правила соседнего владельца
    // подхватывается слоем radius и восстанавливает AP от чужого удара.
    conditions: [{type: 'chance', probability: 15}, {type: 'eventRole', role: 'source'}],
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
    // eventRole: 'source' обязателен: иначе копия правила соседнего владельца
    // подхватывается слоем radius и модифицирует урон повторно.
    conditions: [
      {type: 'eventRole', role: 'source'},
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
  {
    // «Берсерк»: владелец, сам истекающий кровью, наносит больше урона оружием
    // (план docs/plans/bleed-builds-implementation.md, этап 2). Величина —
    // ролленное значение аффикса (ownerParam, scaling: perLevel у модификатора).
    // eventRole: 'source' обязателен: иначе копия правила соседнего владельца
    // подхватывается слоем radius и модифицирует урон повторно.
    id: 'amulet_blood_frenzy',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'bleeding', subject: 'self'},
    ],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: {type: 'ownerParam'},
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
    // eventRole: 'target' обязателен: без него копия правила соседнего
    // отравленного актора подхватывается слоем radius и наносит урон
    // тикающей сущности повторно.
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'dealDamage',
      amount: {type: 'context', field: 'eventMaxHp', multiply: 0.08, min: 1, round: true},
      tags: ['damage.magical.poison'],
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    id: 'status_bleeding_tick_damage',
    trigger: {
      event: 'STATUS_TICKED',
      tags: ['status.bleeding'],
    },
    // eventRole: 'target' обязателен: без него копия правила соседнего
    // кровоточащего актора подхватывалась бы слоем radius и наносила урон
    // тикающей сущности повторно (по образцу status_poison_tick_damage).
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'dealDamage',
      // Плоские 2 HP за тик (решение 2026-08-27, смена с 8% maxHp —
      // процент от maxHp был слишком силён против толстых целей/босса).
      // Число черновое — балансный проход roadMap 1.4.
      amount: 2,
      // Кровотечение — внутренний урон (damage.internal.*): броня его не режет,
      // она защищает только от внешнего физического урона (damage.physical.*).
      tags: ['damage.internal.bleeding'],
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
  // Мышеловка (концепт этажа 1, §4.7): урон + кровотечение + обездвиживание
  // одним срабатыванием. Статусы разнесены по категориям (bleeding — wound,
  // rooted — control), чтобы оба прошли одним батчем без конфликтов
  // в resolveStatusBatch. Числа черновые — балансный проход roadMap 1.4.
  {
    id: 'mousetrap_deal_damage',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    effect: {
      type: 'dealDamage',
      amount: 8,
      tags: ['damage.physical.piercing'],
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  {
    id: 'mousetrap_apply_bleeding',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 3,
    },
    target: {type: 'eventSource'},
    priority: 0,
  },
  {
    id: 'mousetrap_apply_rooted',
    trigger: {
      event: 'ENTITY_MOVED',
    },
    effect: {
      type: 'applyStatus',
      statusType: 'rooted',
      duration: 2,
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
    // Плюс «Договора с подвалом»: прямой исходящий урон оружия +2.
    id: 'relic_blood_pact_power',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 2,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
  {
    // Минус: прямой входящий урон оружия по владельцу +1.
    id: 'relic_blood_pact_price',
    polarity: 'negative',
    trigger: {
      event: 'DAMAGE',
      tags: ['delivery.weapon'],
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'modifyDamage',
      op: 'add',
      value: 1,
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
  // ── Правила реликвий кровавой ветки (этап 3 плана bleed-builds) ────────────
  // docs/plans/bleed-builds-implementation.md, §4.2 концепта: у каждой реликвии
  // плюс + равнозначный минус (polarity: 'negative'). Числа черновые —
  // балансный проход roadMap 1.4.
  {
    // Плюс «Пиявки»: тик чужого кровотечения рядом лечит владельца.
    // «Рядом» — слой radius (радиус 1 от позиции тика). Условие
    // not eventRole: 'target' отсекает собственный тик владельца
    // (тогда владелец — цель события и собирается слоем target):
    // своя кровь Пиявку не кормит (анти-синергия с «Кровавым топливом» — задумано).
    id: 'relic_blood_leech_tick_heal',
    trigger: {
      event: 'STATUS_TICKED',
      tags: ['status.bleeding'],
    },
    conditions: [
      {type: 'not', condition: {type: 'eventRole', role: 'target'}},
    ],
    effect: {
      type: 'heal',
      amount: 1,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Плюс «Кровавого эха»: владелец своим ударом добивает кровоточащего —
    // лечится на 2 HP. eventRole: 'source' отсекает дот-киллы (тик кровотечения
    // принадлежит жертве — источник смерти она сама) и чужие убийства.
    id: 'relic_blood_echo_heal_on_bleed_kill',
    trigger: {
      event: 'ENTITY_DIED',
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
    ],
    effect: {
      type: 'heal',
      amount: 2,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Минус «Кровавого эха» (решение §1 п. 3 плана): когда у любой сущности
    // спадает кровотечение (естественное спадание, вытеснение, стеки → 0),
    // владелец получает 1 внутренний урон. Смерть STATUS_REMOVED не порождает
    // (статусы остаются на трупе), поэтому добивание кровоточащего не штрафуется.
    // reach: 'global' — спадание может произойти вне радиуса владельца;
    // eventRole не нужен: штрафует спадание у ЛЮБОЙ сущности, включая владельца.
    id: 'relic_blood_echo_bleed_faded',
    polarity: 'negative',
    trigger: {
      event: 'STATUS_REMOVED',
    },
    conditions: [
      {type: 'eventFieldEquals', field: 'effectType', value: 'bleeding'},
    ],
    effect: {
      type: 'dealDamage',
      amount: 1,
      tags: ['damage.internal.bleeding'],
    },
    target: {type: 'self'},
    priority: 0,
    reach: 'global',
  },
  {
    // Плюс «Жатвы»: владелец своим ударом добивает кровоточащего — возвращается
    // 1 AP. Реакции на смерть разрешаются до списания стоимости действия,
    // поэтому при полных AP дельта 0 (кламп к эффективному maxAp).
    id: 'relic_blood_reaper_harvest',
    trigger: {
      event: 'ENTITY_DIED',
    },
    conditions: [
      {type: 'eventRole', role: 'source'},
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
    ],
    effect: {
      type: 'restoreAp',
      amount: 1,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Минус «Жатвы» («Чужой урожай»): кровоточащий умер не от руки владельца
    // (дот-килл — источник сама жертва, мышеловка, взрыв, среда без источника) —
    // владелец теряет 1 AP. not eventRole: 'target' отсекает смерть самого
    // владельца. reach: 'global' — смерть может произойти вне радиуса владельца.
    id: 'relic_blood_reaper_foreign_harvest',
    polarity: 'negative',
    trigger: {
      event: 'ENTITY_DIED',
    },
    conditions: [
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
      {type: 'not', condition: {type: 'eventRole', role: 'source'}},
      {type: 'not', condition: {type: 'eventRole', role: 'target'}},
    ],
    effect: {
      type: 'consumeAp',
      amount: 1,
    },
    target: {type: 'self'},
    priority: 0,
    reach: 'global',
  },
  {
    // Плюс «Кровавого топлива»: тик собственного кровотечения возвращает 1 AP.
    // eventRole: 'target' обязателен — иначе копия правила из слоя radius
    // срабатывала бы на чужие тики рядом.
    id: 'relic_blood_fuel_self_tick',
    trigger: {
      event: 'STATUS_TICKED',
      tags: ['status.bleeding'],
    },
    conditions: [{type: 'eventRole', role: 'target'}],
    effect: {
      type: 'restoreAp',
      amount: 1,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Минус «Кровавого топлива» («Обескровлен»): спадание кровотечения
    // владельца отнимает 1 AP. reach не нужен: владелец — цель события
    // и собирается слоем target.
    id: 'relic_blood_fuel_exsanguinated',
    polarity: 'negative',
    trigger: {
      event: 'STATUS_REMOVED',
    },
    conditions: [
      {type: 'eventFieldEquals', field: 'effectType', value: 'bleeding'},
      {type: 'eventRole', role: 'target'},
    ],
    effect: {
      type: 'consumeAp',
      amount: 1,
    },
    target: {type: 'self'},
    priority: 0,
  },
  {
    // Детонация «Разрывателя» (минус реликвии): смерть кровоточащего бьёт
    // всех живых в радиусе 1 от позиции смерти — селектор без excludeSelf,
    // поэтому владелец рядом получает те же 4 внутреннего урона
    // (позиционная игра: провоцировать разрыв на дистанции). Труп исключён:
    // allInRadius работает только по живым акторам. reach: 'global' —
    // владелец может стоять далеко от детонации (позиционная фича).
    id: 'relic_blood_rupture_detonation',
    polarity: 'negative',
    trigger: {
      event: 'ENTITY_DIED',
    },
    conditions: [
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
    ],
    effect: {
      type: 'dealDamage',
      amount: 4,
      tags: ['damage.internal.bleeding'],
    },
    target: {type: 'allInRadius', radius: 1, center: 'eventPosition'},
    priority: 0,
    reach: 'global',
  },
  {
    // Плюс «Разрывателя»: выжившие в радиусе детонации подхватывают
    // кровотечение на 2 хода. priority 1 — исполняется после детонации:
    // убитые взрывом (мёртвые к моменту волны) кровотечение не получают.
    // По модели 1 детонирует и ваншот рубящим: смертельный удар успевает
    // наложить кровотечение до ENTITY_DIED.
    id: 'relic_blood_rupture_bleed_splash',
    trigger: {
      event: 'ENTITY_DIED',
    },
    conditions: [
      {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
    ],
    effect: {
      type: 'applyStatus',
      statusType: 'bleeding',
      duration: 2,
    },
    target: {type: 'allInRadius', radius: 1, center: 'eventPosition'},
    priority: 1,
    reach: 'global',
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
