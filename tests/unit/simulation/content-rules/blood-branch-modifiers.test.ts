/**
 * Тесты модификаторов кровавой ветки (этап 2 плана
 * docs/plans/bleed-builds-implementation.md).
 *
 * Как и weapon-sword-rules.test.ts, проверяются РЕАЛЬНЫЕ правила из
 * CONTENT_RULES — тест фиксирует текущие числа контента. Числа черновые
 * (балансный проход roadMap 1.4), при ребалансе правятся вместе с правилами.
 *
 * Проверяет:
 * - `weapon_bleeding_widening` (mod_blood_widening_wound): удар по уже
 *   кровоточащей цели продлевает кровотечение до 5 ходов; priority 1
 *   гарантирует исполнение ПОСЛЕ weapon_bleeding_on_hit (priority 0), потому
 *   что applyStatus на висящем статусе перезаписывает duration;
 * - `armor_bleeding_thorns` (mod_blood_thorns): кровотечение на 2 хода
 *   нападающему в ближнем бою, защита от self-hit (notSelfHit) и от
 *   дублирования копией соседнего владельца из слоя radius (eventRole);
 * - `amulet_blood_frenzy` (mod_blood_frenzy): modifyDamage add на величину
 *   ownerParam (ролл аффикса), только когда владелец сам кровоточит.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getContentRule} from '../../../../src/simulation/content-rules/registry';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {applyIntentModifiers} from '../../../../src/simulation/content-rules/modifiers/apply-intent-modifiers';
import {buildRuleContext} from '../../../../src/simulation/content-rules/rule-context';
import {executeIntents} from '../../../../src/simulation/systems/intents/execute-intent';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {ActiveRule} from '../../../../src/simulation/content-rules/types';
import type {Entity, EntityId, GameState} from '../../../../src/simulation/types';
import type {StatusTemplate} from '../../../../src/content/schemas';
import {resetRegistry} from '../../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';

const BASE_DAMAGE = 10;

/** Мок шаблона bleeding с реальной категорией контента (wound). */
function mockBleedingTemplate(): StatusTemplate {
  return {
    id: 'bleeding',
    ruleIds: [],
    statusCategory: 'wound',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  } as StatusTemplate;
}

/**
 * Оборачивает реальное правило реестра в ActiveRule указанного владельца.
 * paramValue — ролленное значение rule-аффикса (для правил с ownerParam).
 */
function ownedRule(ruleId: string, ownerId: string, paramValue?: number): ActiveRule {
  return {
    ...getContentRule(ruleId),
    ownerContext: {type: 'entity', entityId: ownerId},
    ...(paramValue !== undefined ? {paramValue} : {}),
  };
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

/** Исполняет интенты реакций, чтобы проверить итоговое состояние статусов. */
function applyIntents(state: GameState, event: GameEvent, intents: Intent[]): void {
  const builder = new ExecutionBuilder(event);
  executeIntents(state, intents, builder, builder.root);
}

function makeDamagedEvent(
  overrides: Partial<Extract<GameEvent, {type: 'ENTITY_DAMAGED'}>> = {},
): Extract<GameEvent, {type: 'ENTITY_DAMAGED'}> {
  return {
    type: 'ENTITY_DAMAGED',
    isFieldEvent: true,
    targetId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: 5,
    position: {x: 6, y: 5},
    tags: ['delivery.weapon', 'damage.physical.slashing'],
    ...overrides,
  };
}

function makeDamageIntent(
  overrides: Partial<Extract<Intent, {type: 'DAMAGE'}>> = {},
): Extract<Intent, {type: 'DAMAGE'}> {
  return {
    type: 'DAMAGE',
    entityId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: BASE_DAMAGE,
    tags: ['delivery.weapon', 'damage.physical.slashing'],
    ...overrides,
  };
}

function runDamageModifiers(
  state: GameState,
  intent: Extract<Intent, {type: 'DAMAGE'}>,
): Extract<Intent, {type: 'DAMAGE'}> {
  return applyIntentModifiers(state, intent, buildRuleContext(state, intent)) as Extract<Intent, {type: 'DAMAGE'}>;
}

function makeBleeding(duration = 2) {
  return {type: 'bleeding' as const, duration, value: 0, statModifiers: null};
}

describe('weapon_bleeding_widening — продление кровотечения до 5 ходов', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    // Мировые правила отключены: тест изолирует именно source-bound правила.
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('удар по кровоточащей цели обновляет длительность до 5 ходов', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_widening', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    enemy.statusEffects.push(makeBleeding(2));
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent());

    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: expect.objectContaining({type: 'bleeding', duration: 5}),
    }));
  });

  it('вместе с weapon_bleeding_on_hit итоговая длительность — 5 (widening исполняется последним)', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('weapon_bleeding_on_hit', 'player'),
        ownedRule('weapon_bleeding_widening', 'player'),
      ],
    });
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    enemy.statusEffects.push(makeBleeding(2));
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeDamagedEvent();
    const intents = runReactions(state, event);

    // Оба правила срабатывают; applyStatus перезаписывает duration, поэтому
    // продление (5) обязано идти после on-hit (3) — это гарантирует priority 1.
    const durations = intents
      .filter((intent) => intent.type === 'APPLY_STATUS')
      .map((intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).status.duration);
    expect(durations).toEqual([3, 5]);

    applyIntents(state, event, intents);
    const bleeding = enemy.statusEffects.find((effect) => effect.type === 'bleeding');
    expect(bleeding?.duration).toBe(5);
  });

  it('по свежей цели не срабатывает: итоговая длительность — 3 от on_hit', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('weapon_bleeding_on_hit', 'player'),
        ownedRule('weapon_bleeding_widening', 'player'),
      ],
    });
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeDamagedEvent();
    const intents = runReactions(state, event);

    // Widening молчит (hasStatus bleeding на цели не выполняется) —
    // остаётся только on-hit с длительностью 3.
    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      status: expect.objectContaining({type: 'bleeding', duration: 3}),
    }));

    applyIntents(state, event, intents);
    const bleeding = enemy.statusEffects.find((effect) => effect.type === 'bleeding');
    expect(bleeding?.duration).toBe(3);
  });

  it('не срабатывает, когда владелец — цель события (eventRole: source)', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_widening', 'player')]});
    player.statusEffects.push(makeBleeding(2));
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Враг бьёт кровоточащего владельца рубящим оружием — копия правила
    // владельца из слоёв target/radius не должна продлевать ему кровотечение.
    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: {x: player.x, y: player.y},
    }));

    expect(intents).toHaveLength(0);
  });
});

describe('armor_bleeding_thorns — кровотечение нападающего', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  /** Событие: enemy_test_1 бьёт владельца брони (player) в ближнем бою. */
  function makeMeleeHitOnOwner(): Extract<GameEvent, {type: 'ENTITY_DAMAGED'}> {
    return makeDamagedEvent({
      targetId: 'player',
      sourceEntityId: 'enemy_test_1',
      position: {x: 5, y: 5},
      tags: ['attack.melee', 'delivery.weapon', 'damage.physical.slashing'],
    });
  }

  it('нападающий в ближнем бою получает кровотечение на 2 хода', () => {
    const player = makePlayer({activeRules: [ownedRule('armor_bleeding_thorns', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeMeleeHitOnOwner());

    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: expect.objectContaining({type: 'bleeding', duration: 2}),
    }));
  });

  it('self-hit владельца не вешает кровотечение на него самого (notSelfHit)', () => {
    const player = makePlayer({activeRules: [ownedRule('armor_bleeding_thorns', 'player')]});
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 8, y: 8}));

    // Владелец сам себя задевает атакой с тегом attack.melee (например, Налёт).
    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: player.id,
      position: {x: player.x, y: player.y},
      tags: ['attack.melee', 'delivery.ability', 'damage.physical.blunt'],
    }));

    expect(intents).toHaveLength(0);
  });

  it('копия правила соседнего владельца не дублируется из слоя radius (eventRole: target)', () => {
    const player = makePlayer({activeRules: [ownedRule('armor_bleeding_thorns', 'player')]});
    const attacker = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    // Соседний владелец того же правила в радиусе 1 от позиции события.
    const neighbor = makeEnemy({
      id: 'enemy_test_2',
      x: 6,
      y: 6,
      activeRules: [ownedRule('armor_bleeding_thorns', 'enemy_test_2')],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [attacker.id, attacker],
        [neighbor.id, neighbor],
      ]),
    });

    const intents = runReactions(state, makeMeleeHitOnOwner());

    // Срабатывает только копия владельца-цели (player): ровно один APPLY_STATUS.
    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: attacker.id,
      status: expect.objectContaining({type: 'bleeding', duration: 2}),
    }));
  });
});

describe('amulet_blood_frenzy — бонус урона, пока владелец кровоточит', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('урон растёт на величину аффикса (ownerParam), когда владелец кровоточит', () => {
    const player = makePlayer({activeRules: [ownedRule('amulet_blood_frenzy', 'player', 2)]});
    player.statusEffects.push(makeBleeding(2));
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE + 2);
  });

  it('без кровотечения у владельца урон не меняется', () => {
    const player = makePlayer({activeRules: [ownedRule('amulet_blood_frenzy', 'player', 2)]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE);
  });

  it('кровотечение цели без кровотечения владельца бонуса не даёт (subject: self)', () => {
    const player = makePlayer({activeRules: [ownedRule('amulet_blood_frenzy', 'player', 2)]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    enemy.statusEffects.push(makeBleeding(2));
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE);
  });

  it('копия правила у цели не дублирует модификатор (eventRole: source)', () => {
    const player = makePlayer({activeRules: [ownedRule('amulet_blood_frenzy', 'player', 2)]});
    player.statusEffects.push(makeBleeding(2));
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [ownedRule('amulet_blood_frenzy', 'enemy_test_1', 5)],
    });
    enemy.statusEffects.push(makeBleeding(2));
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Цель тоже владеет правилом и кровоточит, но она — target интента:
    // её копия (paramValue 5) не должна примениться.
    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE + 2);
  });
});
