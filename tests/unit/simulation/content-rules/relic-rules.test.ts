/**
 * Тесты правил реликвий стартового пула (roadmap 0.6).
 *
 * Каждая реликвия — «плюс» и «минус»; проверяются оба:
 * - правила `applyStatus`/`heal` — через `runContentRuleReactions`;
 * - правила `modifyDamage` — через `applyIntentModifiers` (слой исполнения DAMAGE-интента);
 * - минусы через `statModifiers` (acid_blood, scavenger) — через реальный контент и GRANT_RELIC;
 * - стакаемость выключена: повторная выдача той же реликвии отклоняется.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {CONTENT_RULES} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {applyIntentModifiers} from '../../../../src/simulation/content-rules/modifiers/apply-intent-modifiers';
import {buildRuleContext} from '../../../../src/simulation/content-rules/rule-context';
import {executeGrantRelicIntent} from '../../../../src/simulation/systems/intents/grant-relic-intent-executor';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {ActiveRule} from '../../../../src/simulation/content-rules/types';
import type {GameState} from '../../../../src/simulation/types';
import {
  makeEnemy,
  makeGameState,
  makePlayer,
  makeStateWithPlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';
import {buildContent} from '../../../../src/content/templates';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

/** Достаёт правило из CONTENT_RULES и оборачивает в ActiveRule владельца-реликвии. */
function relicRule(id: string): ActiveRule {
  const rule = CONTENT_RULES.find((r) => r.id === id);
  if (!rule) {
    throw new Error(`Правило не найдено в CONTENT_RULES: ${id}`);
  }
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
    damage: 10,
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
  it('salamander_heart (плюс): урон оружия владельца получает тег damage.magical.fire', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_salamander_heart_fire_infusion')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    }));

    expect(result.damage).toBe(10);
    expect(result.tags).toContain('damage.magical.fire');
    expect(result.tags).toContain('damage.physical.slashing');
  });

  it('salamander_heart (плюс): не срабатывает на входящий урон (владелец — target)', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_salamander_heart_fire_infusion')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
    }));

    expect(result.tags).not.toContain('damage.magical.fire');
  });

  it('salamander_heart (минус): входящий огонь по владельцу ×1.25', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_salamander_heart_fire_vulnerability')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const incoming = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
      tags: ['damage.magical.fire'],
    }));
    expect(incoming.damage).toBeCloseTo(12.5, 10);

    // Исходящий огонь владельца не усиливается.
    const outgoing = runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.magical.fire'],
    }));
    expect(outgoing.damage).toBe(10);
  });

  it('venom_gland (минус): -1 к урону по неотравленной цели, по отравленной — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_venom_gland_ramp_up')] });
    const cleanEnemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, cleanEnemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(9);

    cleanEnemy.statusEffects.push({ type: 'poisoned', duration: 2, value: 0, statModifiers: null });
    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(10);
  });

  it('thunderhead (минус): -1 к урону недробящим оружием, дробящее — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_thunderhead_clumsy')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.slashing'],
    })).damage).toBe(9);
    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.weapon', 'damage.physical.blunt'],
    })).damage).toBe(10);
  });

  it('opportunist (плюс): +3 к урону по ослабленной цели (dazed/stunned/poisoned)', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_opportunist_bonus')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(10);

    for (const statusType of ['dazed', 'stunned', 'poisoned'] as const) {
      enemy.statusEffects = [{ type: statusType, duration: 1, value: 0, statModifiers: null }];
      expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(13);
    }
  });

  it('opportunist (минус): -1 к урону по полноценному противнику, по ослабленному — без штрафа', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_opportunist_hesitant')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(9);

    enemy.statusEffects.push({ type: 'poisoned', duration: 1, value: 0, statModifiers: null });
    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(10);
  });

  it('blood_pact (плюс): +4 ко всему исходящему урону без фильтра тегов', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_blood_pact_power')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runDamageModifiers(state, makeDamageIntent()).damage).toBe(14);
    expect(runDamageModifiers(state, makeDamageIntent({
      tags: ['delivery.ability', 'damage.magical.fire'],
    })).damage).toBe(14);
  });

  it('blood_pact (минус): входящий урон по владельцу ×1.25', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_blood_pact_price')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const incoming = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
      tags: [],
    }));
    expect(incoming.damage).toBeCloseTo(12.5, 10);

    // Исходящий урон владельца не усиливается минусом.
    expect(runDamageModifiers(state, makeDamageIntent({ tags: [] })).damage).toBe(10);
  });
});

describe('правила реликвий — applyStatus / heal', () => {
  it('venom_gland (плюс): удар оружия отравляет цель на 3 хода', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_venom_gland_poison_on_hit')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent());

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'poisoned', duration: 3 },
    });
  });

  it('venom_gland (плюс): не срабатывает на входящий урон (владелец — target)', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_venom_gland_poison_on_hit')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: { x: 5, y: 5 },
    }));

    expect(intents).toHaveLength(0);
  });

  it('acid_blood (плюс): атакующий владельца в ближнем бою получает отравление на 2 хода', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_acid_blood_poison_attacker')] });
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
      status: { type: 'poisoned', duration: 2 },
    });
  });

  it('acid_blood (плюс): не срабатывает на дальнюю атаку и на исходящий урон', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_acid_blood_poison_attacker')] });
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

  it('plague_bearer (плюс): удар по отравленному разносит заразу на врагов в радиусе 1', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [relicRule('relic_plague_bearer_spread')],
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
      expect((intent as Extract<Intent, { type: 'APPLY_STATUS' }>).status.duration).toBe(2);
    }
  });

  it('plague_bearer (плюс и минус): не срабатывают по неотравленной цели', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [
        relicRule('relic_plague_bearer_spread'),
        relicRule('relic_plague_bearer_self_poison'),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runReactions(state, makeDamagedEvent())).toHaveLength(0);
  });

  it('plague_bearer (минус): при переносе заразы владелец получает отравление на 1 ход', () => {
    const player = makePlayer({
      x: 5, y: 5,
      factionId: 'player',
      activeRules: [relicRule('relic_plague_bearer_self_poison')],
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
      status: { type: 'poisoned', duration: 1 },
    });
  });

  it('thunderhead (плюс): дробящий удар оружия ошеломляет цель на 1 ход', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_thunderhead_daze')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent({
      tags: ['damage.physical.blunt', 'delivery.weapon'],
    }));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'dazed', duration: 1 },
    });
  });

  it('thunderhead (плюс): не срабатывает без дробящего тега', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_thunderhead_daze')] });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    expect(runReactions(state, makeDamagedEvent({
      tags: ['damage.physical.slashing', 'delivery.weapon'],
    }))).toHaveLength(0);
  });

  it('thunderhead (плюс): не ошеломляет владельца при дробящем ударе ПО нему', () => {
    // Регрессия: без eventRole: 'source' правило собиралось из target-слоя
    // и гарантированно дезило самого владельца при каждом дробящем ударе
    // по нему (безоружные атаки котов несут damage.physical.blunt + delivery.weapon).
    const player = makePlayer({ activeRules: [relicRule('relic_thunderhead_daze')] });
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

  it('scavenger (плюс): поднятие предмета лечит владельца на 5 HP', () => {
    const player = makePlayer({ activeRules: [relicRule('relic_scavenger_heal_on_pickup')] });
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
    expect(intents[0]).toEqual({ type: 'HEAL', entityId: player.id, amount: 5 });
  });
});

describe('шаблоны реликвий на реальном контенте', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(buildContent());
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

  function makeRealState() {
    const player = makePlayer();
    return {
      player,
      state: makeGameState({ player, entities: new Map([['player', player]]) }),
    };
  }

  it('все 8 реликвий нестакаемы: повторная выдача отклоняется', () => {
    const relicIds = [
      'relic_salamander_heart',
      'relic_venom_gland',
      'relic_acid_blood',
      'relic_plague_bearer',
      'relic_thunderhead',
      'relic_opportunist',
      'relic_blood_pact',
      'relic_scavenger',
    ];

    for (const relicId of relicIds) {
      const { player, state } = makeRealState();
      expect(grant(state, relicId), relicId).not.toBeNull();
      expect(grant(state, relicId), relicId).toBeNull();
      expect(player.relics).toHaveLength(1);
    }
  });

  it('минусы через statModifiers применяются при выдаче (acid_blood: -1 броня, scavenger: -5 maxHp)', () => {
    const { player, state } = makeRealState();

    grant(state, 'relic_acid_blood');
    grant(state, 'relic_scavenger');

    expect(player.statModifiers).toContainEqual(
      expect.objectContaining({ stat: 'armor', value: -1, op: 'add', source: 'relic_relic_1' }),
    );
    expect(player.statModifiers).toContainEqual(
      expect.objectContaining({ stat: 'maxHp', value: -5, op: 'add', source: 'relic_relic_2' }),
    );
  });
});
