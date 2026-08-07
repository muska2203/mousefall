/**
 * Тесты механик правил реликвий (roadmap 0.6).
 *
 * Движок проверяется на тестовых правилах, определённых в этом файле:
 * - правила `applyStatus`/`heal` — через `runContentRuleReactions`;
 * - правила `modifyDamage` — через `applyIntentModifiers` (слой исполнения DAMAGE-интента);
 * - выдача реликвии (GRANT_RELIC): нестакаемость и `statModifiers` — на синтетических
 *   шаблонах в собственном реестре.
 *
 * Числа в assert'ах происходят из фикстур теста, а не из `rules.ts`/шаблонов,
 * поэтому балансные правки реального контента тест не ломают.
 * Тестовые правила повторяют форму реальных правил реликвий (eventRole,
 * условия по тегам/статусам), но с собственными id и значениями.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {applyIntentModifiers} from '../../../../src/simulation/content-rules/modifiers/apply-intent-modifiers';
import {buildRuleContext} from '../../../../src/simulation/content-rules/rule-context';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {executeGrantRelicIntent} from '../../../../src/simulation/systems/intents/grant-relic-intent-executor';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {
  ActiveRule,
  ContentRule,
  WorldContentRule,
} from '../../../../src/simulation/content-rules/types';
import type {GameState} from '../../../../src/simulation/types';
import type {RelicTemplate} from '../../../../src/content/schemas';
import {
  createObjectContent,
  makeEnemy,
  makeGameState,
  makePlayer,
  makeStateWithPlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

// ─────────────────────────────────────────────
// Тестовые числа (намеренно не совпадают с балансом реальных правил)
// ─────────────────────────────────────────────

const TEST_VULNERABILITY_MULTIPLIER = 1.5;
const TEST_PRICE_MULTIPLIER = 1.5;
const TEST_RAMP_UP_PENALTY = -2;
const TEST_CLUMSY_PENALTY = -2;
const TEST_DEBUFF_BONUS = 4;
const TEST_HESITANT_PENALTY = -2;
const TEST_UNTAGGED_BONUS = 5;
const TEST_POISON_ON_HIT_DURATION = 4;
const TEST_POISON_ATTACKER_DURATION = 5;
const TEST_SPREAD_DURATION = 4;
const TEST_SELF_POISON_DURATION = 2;
const TEST_DAZE_DURATION = 2;
const TEST_HEAL_AMOUNT = 7;
const TEST_CRIT_MULTIPLIER = 2;

const BASE_DAMAGE = 10;

// ─────────────────────────────────────────────
// Тестовые правила: повторяют механики реальных правил реликвий
// ─────────────────────────────────────────────

/** Плюс: урон оружия владельца получает дополнительный тег (огненная инфузия). */
const testInfusionRule: ContentRule = {
  id: 'test_relic_fire_infusion',
  trigger: {event: 'DAMAGE', tags: ['delivery.weapon']},
  conditions: [{type: 'eventRole', role: 'source'}],
  effect: {type: 'modifyDamage', op: 'add', value: 0, addTags: ['damage.magical.fire']},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Минус: входящий урон по тегу по владельцу умножается. */
const testVulnerabilityRule: ContentRule = {
  id: 'test_relic_fire_vulnerability',
  trigger: {event: 'DAMAGE', tags: ['damage.magical.fire']},
  conditions: [{type: 'eventRole', role: 'target'}],
  effect: {type: 'modifyDamage', op: 'multiply', value: TEST_VULNERABILITY_MULTIPLIER},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Плюс: удар оружия накладывает статус на цель. */
const testPoisonOnHitRule: ContentRule = {
  id: 'test_relic_poison_on_hit',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['delivery.weapon']},
  conditions: [{type: 'eventRole', role: 'source'}],
  effect: {type: 'applyStatus', statusType: 'poisoned', duration: TEST_POISON_ON_HIT_DURATION},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Минус: штраф к урону по цели без статуса. */
const testRampUpRule: ContentRule = {
  id: 'test_relic_ramp_up',
  trigger: {event: 'DAMAGE', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'not', condition: {type: 'hasStatus', statusType: 'poisoned', subject: 'target'}},
  ],
  effect: {type: 'modifyDamage', op: 'add', value: TEST_RAMP_UP_PENALTY},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Плюс: атакующий владельца в ближнем бою получает статус. */
const testPoisonAttackerRule: ContentRule = {
  id: 'test_relic_poison_attacker',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['attack.melee']},
  conditions: [{type: 'eventRole', role: 'target'}],
  effect: {type: 'applyStatus', statusType: 'poisoned', duration: TEST_POISON_ATTACKER_DURATION},
  target: {type: 'eventSource'},
  priority: 0,
};

/** Плюс: удар по цели со статусом разносит статус на врагов в радиусе. */
const testSpreadRule: ContentRule = {
  id: 'test_relic_plague_spread',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
  ],
  effect: {type: 'applyStatus', statusType: 'poisoned', duration: TEST_SPREAD_DURATION},
  target: {type: 'allInRadius', radius: 1, center: 'eventPosition', faction: 'enemy', excludeSelf: true},
  priority: 0,
};

/** Минус: при переносе заразы владелец получает статус сам. */
const testSelfPoisonRule: ContentRule = {
  id: 'test_relic_self_poison',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
  ],
  effect: {type: 'applyStatus', statusType: 'poisoned', duration: TEST_SELF_POISON_DURATION},
  target: {type: 'self'},
  priority: 0,
};

/** Плюс: дробящий удар оружия ошеломляет цель. */
const testDazeRule: ContentRule = {
  id: 'test_relic_blunt_daze',
  trigger: {event: 'ENTITY_DAMAGED', tags: ['damage.physical.blunt', 'delivery.weapon']},
  conditions: [{type: 'eventRole', role: 'source'}],
  effect: {type: 'applyStatus', statusType: 'dazed', duration: TEST_DAZE_DURATION},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Минус: штраф к урону без нужного тега. */
const testClumsyRule: ContentRule = {
  id: 'test_relic_clumsy',
  trigger: {event: 'DAMAGE', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'not', condition: {type: 'hasTag', tag: 'damage.physical.blunt'}},
  ],
  effect: {type: 'modifyDamage', op: 'add', value: TEST_CLUMSY_PENALTY},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Набор статусов-ослаблений для тестовых правил бонуса/штрафа. */
const debuffConditions = [
  {type: 'hasStatus', statusType: 'dazed', subject: 'target'},
  {type: 'hasStatus', statusType: 'stunned', subject: 'target'},
  {type: 'hasStatus', statusType: 'poisoned', subject: 'target'},
] as const;

/** Плюс: бонус к урону по ослабленной цели. */
const testDebuffBonusRule: ContentRule = {
  id: 'test_relic_debuff_bonus',
  trigger: {event: 'DAMAGE', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'or', conditions: [...debuffConditions]},
  ],
  effect: {type: 'modifyDamage', op: 'add', value: TEST_DEBUFF_BONUS},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Минус: штраф к урону по цели без ослаблений. */
const testHesitantRule: ContentRule = {
  id: 'test_relic_hesitant',
  trigger: {event: 'DAMAGE', tags: ['delivery.weapon']},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'not', condition: {type: 'or', conditions: [...debuffConditions]}},
  ],
  effect: {type: 'modifyDamage', op: 'add', value: TEST_HESITANT_PENALTY},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Плюс: бонус ко всему исходящему урону без фильтра тегов. */
const testUntaggedBonusRule: ContentRule = {
  id: 'test_relic_untagged_power',
  trigger: {event: 'DAMAGE'},
  conditions: [{type: 'eventRole', role: 'source'}],
  effect: {type: 'modifyDamage', op: 'add', value: TEST_UNTAGGED_BONUS},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Минус: любой входящий урон по владельцу умножается. */
const testPriceRule: ContentRule = {
  id: 'test_relic_incoming_price',
  trigger: {event: 'DAMAGE'},
  conditions: [{type: 'eventRole', role: 'target'}],
  effect: {type: 'modifyDamage', op: 'multiply', value: TEST_PRICE_MULTIPLIER},
  target: {type: 'eventTarget'},
  priority: 0,
};

/** Плюс: поднятие предмета лечит владельца. */
const testHealOnPickupRule: ContentRule = {
  id: 'test_relic_heal_on_pickup',
  trigger: {event: 'ITEM_PICKED_UP'},
  conditions: [{type: 'eventRole', role: 'source'}],
  effect: {type: 'heal', amount: TEST_HEAL_AMOUNT},
  target: {type: 'self'},
  priority: 0,
};

/**
 * Тестовое мировое правило крита по ослабленной цели.
 * Замещает реальные мировые правила в тесте бонуса по ослаблённым,
 * чтобы ожидаемые числа не зависели от баланса мировых правил.
 */
const testWorldCritRule: WorldContentRule = {
  id: 'test_world_crit_on_dazed_stunned',
  trigger: {event: 'DAMAGE'},
  conditions: [
    {
      type: 'or',
      conditions: [
        {type: 'hasStatus', statusType: 'dazed', subject: 'target'},
        {type: 'hasStatus', statusType: 'stunned', subject: 'target'},
      ],
    },
  ],
  effect: {type: 'modifyDamage', op: 'multiply', value: TEST_CRIT_MULTIPLIER, addTags: ['crit']},
  target: {type: 'eventTarget'},
  priority: 0,
  ownerContext: {type: 'world'},
  worldLayer: 'global',
};

// ─────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────

/** Оборачивает тестовое правило в ActiveRule владельца-реликвии. */
function relicRule(rule: ContentRule): ActiveRule {
  return { ...rule, ownerContext: { type: 'entity', entityId: 'relic_1' } };
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

function makeDamageIntent(
  overrides: Partial<Extract<Intent, { type: 'DAMAGE' }>> = {},
): Extract<Intent, { type: 'DAMAGE' }> {
  return {
    type: 'DAMAGE',
    entityId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: BASE_DAMAGE,
    tags: ['delivery.weapon'],
    ...overrides,
  };
}

function runDamageModifiers(
  state: GameState,
  intent: Extract<Intent, { type: 'DAMAGE' }>,
): Extract<Intent, { type: 'DAMAGE' }> {
  return applyIntentModifiers(state, intent, buildRuleContext(state, intent)) as Extract<Intent, { type: 'DAMAGE' }>;
}

function makeDamagedEvent(
  overrides: Partial<Extract<GameEvent, { type: 'ENTITY_DAMAGED' }>> = {},
): Extract<GameEvent, { type: 'ENTITY_DAMAGED' }> {
  return {
    type: 'ENTITY_DAMAGED',
    isFieldEvent: true,
    targetId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: 5,
    position: { x: 6, y: 5 },
    tags: ['delivery.weapon'],
    ...overrides,
  };
}

describe('правила реликвий — modifyDamage', () => {
  it('инфузия (плюс): урон оружия владельца получает тег damage.magical.fire', () => {
    const player = makePlayer({ activeRules: [relicRule(testInfusionRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    }));

    expect(result.damage).toBe(BASE_DAMAGE);
    expect(result.tags).toContain('damage.magical.fire');
    expect(result.tags).toContain('damage.physical.slashing');
  });

  it('инфузия (плюс): не срабатывает на входящий урон (владелец — target)', () => {
    const player = makePlayer({ activeRules: [relicRule(testInfusionRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
    }));

    expect(result.tags).not.toContain('damage.magical.fire');
  });

  it('уязвимость (минус): входящий огонь по владельцу умножается', () => {
    const player = makePlayer({ activeRules: [relicRule(testVulnerabilityRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const incoming = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
      tags: ['damage.magical.fire'],
    }));
    expect(incoming.damage).toBeCloseTo(BASE_DAMAGE * TEST_VULNERABILITY_MULTIPLIER, 10);

    // Исходящий огонь владельца не усиливается.
    const outgoing = runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.magical.fire'],
    }));
    expect(outgoing.damage).toBe(BASE_DAMAGE);
  });

  it('разгон (минус): штраф к урону по цели без статуса, по цели со статусом — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule(testRampUpRule)] });
    const cleanEnemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, cleanEnemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE + TEST_RAMP_UP_PENALTY);

    cleanEnemy.statusEffects.push({ type: 'poisoned', duration: 2, value: 0, statModifiers: null });
    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE);
  });

  it('неуклюжесть (минус): штраф к урону без дробящего тега, дробящее — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule(testClumsyRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    })).damage).toBe(BASE_DAMAGE + TEST_CLUMSY_PENALTY);
    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.blunt'],
    })).damage).toBe(BASE_DAMAGE);
  });

  it('бонус по ослабленным (плюс): срабатывает на dazed/stunned/poisoned', () => {
    // Реальные мировые правила замещены тестовым критом, чтобы ожидаемые
    // числа складывались только из фикстур этого файла.
    setWorldContentRulesOverride([testWorldCritRule]);
    try {
      const player = makePlayer({ activeRules: [relicRule(testDebuffBonusRule)] });
      const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE);

      for (const statusType of ['dazed', 'stunned', 'poisoned'] as const) {
        enemy.statusEffects = [{ type: statusType, duration: 1, value: 0, statModifiers: null }];
        // По dazed/stunned дополнительно срабатывает тестовое мировое правило
        // крита: (BASE + бонус) × TEST_CRIT_MULTIPLIER; по poisoned — только бонус.
        const expected = statusType === 'poisoned'
          ? BASE_DAMAGE + TEST_DEBUFF_BONUS
          : (BASE_DAMAGE + TEST_DEBUFF_BONUS) * TEST_CRIT_MULTIPLIER;
        expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(expected);
      }
    } finally {
      setWorldContentRulesOverride(null);
    }
  });

  it('нерешительность (минус): штраф по цели без ослаблений, по ослаблённой — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule(testHesitantRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE + TEST_HESITANT_PENALTY);

    enemy.statusEffects.push({ type: 'poisoned', duration: 1, value: 0, statModifiers: null });
    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE);
  });

  it('сила без фильтра тегов (плюс): бонус ко всему исходящему урону', () => {
    const player = makePlayer({ activeRules: [relicRule(testUntaggedBonusRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(BASE_DAMAGE + TEST_UNTAGGED_BONUS);
    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.ability', 'damage.magical.fire'],
    })).damage).toBe(BASE_DAMAGE + TEST_UNTAGGED_BONUS);
  });

  it('цена (минус): входящий урон по владельцу умножается', () => {
    const player = makePlayer({ activeRules: [relicRule(testPriceRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const incoming = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
      tags: [],
    }));
    expect(incoming.damage).toBeCloseTo(BASE_DAMAGE * TEST_PRICE_MULTIPLIER, 10);

    // Исходящий урон владельца не усиливается минусом.
    expect(runDamageModifiers(state, makeDamageIntent({ tags: [] })).damage).toBe(BASE_DAMAGE);
  });
});

describe('правила реликвий — applyStatus / heal', () => {
  it('яд при ударе (плюс): удар оружия отравляет цель на длительность из фикстуры', () => {
    const player = makePlayer({ activeRules: [relicRule(testPoisonOnHitRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent());

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'poisoned', duration: TEST_POISON_ON_HIT_DURATION },
    });
  });

  it('яд при ударе (плюс): не срабатывает на входящий урон (владелец — target)', () => {
    const player = makePlayer({ activeRules: [relicRule(testPoisonOnHitRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: { x: 5, y: 5 },
    }));

    expect(intents).toHaveLength(0);
  });

  it('яд атакующему (плюс): атакующий владельца в ближнем бою получает отравление', () => {
    const player = makePlayer({ activeRules: [relicRule(testPoisonAttackerRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: { x: 5, y: 5 },
      tags: ['attack.melee'],
    }));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'poisoned', duration: TEST_POISON_ATTACKER_DURATION },
    });
  });

  it('яд атакующему (плюс): не срабатывает на дальнюю атаку и на исходящий урон', () => {
    const player = makePlayer({ activeRules: [relicRule(testPoisonAttackerRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Дальняя атака по владельцу — без тега attack.melee.
    expect(runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: { x: 5, y: 5 },
      tags: ['attack.ranged'],
    }))).toHaveLength(0);

    // Владелец сам атакует в ближнем бою — правило молчит.
    expect(runReactions(state, makeDamagedEvent({
      tags: ['attack.melee'],
    }))).toHaveLength(0);
  });

  it('перенос заразы (плюс): удар по отравленному разносит заразу на врагов в радиусе', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [relicRule(testSpreadRule)],
    });
    const poisonedEnemy = makeEnemy({
      id: 'enemy_poisoned',
      x: 6, y: 5,
      statusEffects: [{ type: 'poisoned', duration: 2, value: 0, statModifiers: null }],
    });
    const bystander = makeEnemy({ id: 'enemy_bystander', x: 6, y: 6 });
    const farEnemy = makeEnemy({ id: 'enemy_far', x: 8, y: 8 });
    const state = makeStateWithPlayerAndEntity(player, poisonedEnemy);
    state.entities.set(bystander.id, bystander);
    state.entities.set(farEnemy.id, farEnemy);

    const intents = runReactions(state, makeDamagedEvent({ targetId: poisonedEnemy.id }));

    const poisonIntents = intents.filter((i) => i.type === 'APPLY_STATUS' && i.status.type === 'poisoned');
    const targetIds = poisonIntents.map((i) => (i as Extract<Intent, { type: 'APPLY_STATUS' }>).entityId);
    // Заражает врагов рядом (включая саму цель — переналожение), но не владельца и не дальнего врага.
    expect(targetIds.sort()).toEqual([bystander.id, poisonedEnemy.id].sort());
    for (const intent of poisonIntents) {
      expect((intent as Extract<Intent, { type: 'APPLY_STATUS' }>).status.duration).toBe(TEST_SPREAD_DURATION);
    }
  });

  it('перенос заразы (плюс и минус): не срабатывают по неотравленной цели', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [
        relicRule(testSpreadRule),
        relicRule(testSelfPoisonRule),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runReactions(state, makeDamagedEvent())).toHaveLength(0);
  });

  it('самозаражение (минус): при переносе заразы владелец получает отравление', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [relicRule(testSelfPoisonRule)],
    });
    const poisonedEnemy = makeEnemy({
      id: 'enemy_poisoned',
      x: 6, y: 5,
      statusEffects: [{ type: 'poisoned', duration: 2, value: 0, statModifiers: null }],
    });
    const state = makeStateWithPlayerAndEntity(player, poisonedEnemy);

    const intents = runReactions(state, makeDamagedEvent({ targetId: poisonedEnemy.id }));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: { type: 'poisoned', duration: TEST_SELF_POISON_DURATION },
    });
  });

  it('ошеломление (плюс): дробящий удар оружия ошеломляет цель', () => {
    const player = makePlayer({ activeRules: [relicRule(testDazeRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      tags: ['damage.physical.blunt', 'delivery.weapon'],
    }));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'dazed', duration: TEST_DAZE_DURATION },
    });
  });

  it('ошеломление (плюс): не срабатывает без дробящего тега', () => {
    const player = makePlayer({ activeRules: [relicRule(testDazeRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runReactions(state, makeDamagedEvent({
      tags: ['damage.physical.slashing', 'delivery.weapon'],
    }))).toHaveLength(0);
  });

  it('ошеломление (плюс): не ошеломляет владельца при дробящем ударе ПО нему', () => {
    // Регрессия: без eventRole: 'source' правило собиралось из target-слоя
    // и гарантированно дезило самого владельца при каждом дробящем ударе
    // по нему (безоружные атаки котов несут damage.physical.blunt + delivery.weapon).
    const player = makePlayer({ activeRules: [relicRule(testDazeRule)] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: 'enemy_test_1',
      position: { x: player.x, y: player.y },
      tags: ['damage.physical.blunt', 'delivery.weapon'],
    }));

    expect(intents).toHaveLength(0);
  });

  it('лечение при поднятии (плюс): поднятие предмета лечит владельца', () => {
    const player = makePlayer({ activeRules: [relicRule(testHealOnPickupRule)] });
    const state = makeStateWithPlayer(player);

    const event: GameEvent = {
      type: 'ITEM_PICKED_UP',
      isFieldEvent: true,
      entityId: player.id,
      itemInstanceId: 'item_1',
      templateId: 'health_potion',
    };
    const intents = runReactions(state, event);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({ type: 'HEAL', entityId: player.id, amount: TEST_HEAL_AMOUNT });
  });
});

describe('выдача реликвии (GRANT_RELIC) на синтетических шаблонах', () => {
  /** Тестовые модификаторы нестакаемых реликвий (значения фикстуры). */
  const CHARM_ARMOR_MODIFIER = -2;
  const PACT_MAX_HP_MODIFIER = -7;

  function mockRelicTemplate(
    overrides: Partial<RelicTemplate> & { id: string },
  ): RelicTemplate {
    return {
      ruleIds: [],
      statModifiers: [],
      stackable: false,
      grantedAbilities: [],
      rarity: 'common',
      ...overrides,
    };
  }

  beforeEach(() => {
    resetRegistry();
    initRegistry(createObjectContent({
      relics: new Map([
        ['relic_test_charm', mockRelicTemplate({
          id: 'relic_test_charm',
          statModifiers: [{ stat: 'armor', value: CHARM_ARMOR_MODIFIER, op: 'add' }],
        })],
        ['relic_test_pact', mockRelicTemplate({
          id: 'relic_test_pact',
          statModifiers: [{ stat: 'maxHp', value: PACT_MAX_HP_MODIFIER, op: 'add' }],
        })],
        ['relic_test_stack', mockRelicTemplate({ id: 'relic_test_stack', stackable: true })],
      ]),
    }));
  });

  afterEach(() => {
    resetRegistry();
  });

  function grant(state: GameState, templateId: string) {
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: { type: 'END_TURN', entityId: 'any' },
    });
    return executeGrantRelicIntent(
      state,
      { type: 'GRANT_RELIC', entityId: 'player', templateId },
      builder,
      builder.root,
    );
  }

  function makeTestState() {
    const player = makePlayer();
    return {
      player,
      state: makeGameState({ player, entities: new Map([['player', player]]) }),
    };
  }

  it('нестакаемая реликвия: повторная выдача отклоняется', () => {
    const { player, state } = makeTestState();

    expect(grant(state, 'relic_test_charm')).not.toBeNull();
    expect(grant(state, 'relic_test_charm')).toBeNull();
    expect(player.relics).toHaveLength(1);
  });

  it('стакаемая реликвия: повторная выдача разрешена', () => {
    const { player, state } = makeTestState();

    expect(grant(state, 'relic_test_stack')).not.toBeNull();
    expect(grant(state, 'relic_test_stack')).not.toBeNull();
    expect(player.relics).toHaveLength(2);
  });

  it('statModifiers шаблона применяются при выдаче с источником экземпляра', () => {
    const { player, state } = makeTestState();

    grant(state, 'relic_test_charm');
    grant(state, 'relic_test_pact');

    const [charmInstance, pactInstance] = player.relics;
    expect(player.statModifiers).toContainEqual(
      expect.objectContaining({
        stat: 'armor',
        value: CHARM_ARMOR_MODIFIER,
        op: 'add',
        source: `relic_${charmInstance?.instanceId}`,
      }),
    );
    expect(player.statModifiers).toContainEqual(
      expect.objectContaining({
        stat: 'maxHp',
        value: PACT_MAX_HP_MODIFIER,
        op: 'add',
        source: `relic_${pactInstance?.instanceId}`,
      }),
    );
  });
});
