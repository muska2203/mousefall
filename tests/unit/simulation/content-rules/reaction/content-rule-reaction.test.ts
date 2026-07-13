/**
 * Unit-тесты реакции контентных правил `runContentRuleReactions`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runContentRuleReactions } from '../../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
} from '../../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../../src/simulation/core-types';
import type { GameEvent, Intent } from '../../../../../src/simulation/core-types';
import type { ActiveRule } from '../../../../../src/simulation/content-rules/types';

vi.mock('../../../../../src/utils/random', () => ({
  randomChance: vi.fn(),
}));

import { randomChance } from '../../../../../src/utils/random';

function makeActiveRule(overrides: Partial<ActiveRule> = {}): ActiveRule {
  return {
    id: 'test_rule',
    trigger: { event: 'ENTITY_DAMAGED' },
    effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
    target: { type: 'eventTarget' },
    priority: 0,
    ownerContext: { type: 'entity', entityId: 'item_1' },
    ...overrides,
  };
}

function runReactions(state: ReturnType<typeof makeStateWithPlayerAndEntity>, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

describe('runContentRuleReactions', () => {
  beforeEach(() => {
    vi.mocked(randomChance).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('применяет статус к eventTarget при срабатывании chance', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'enemy_burn_on_fire',
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.physical.slashing'] },
          effect: { type: 'applyStatus', statusType: 'poisoned', duration: 2 },
          target: { type: 'eventTarget' },
          conditions: [{ type: 'chance', probability: 100 }],
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: ['damage.physical.slashing'],
    };

    const intents = runReactions(state, event);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'poisoned', duration: 2, value: 0, statModifiers: null },
    });
  });

  it('учитывает условие hasStatus: правило срабатывает только при наличии статуса', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      statusEffects: [{ type: 'burning', duration: 1, value: 1, statModifiers: null }],
      activeRules: [
        makeActiveRule({
          id: 'burning_amplifies_damage',
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.physical.slashing'] },
          conditions: [{ type: 'hasStatus', statusType: 'burning', subject: 'self' }],
          effect: { type: 'dealDamage', amount: 3, tags: ['damage.physical.slashing'] },
          target: { type: 'eventTarget' },
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: ['damage.physical.slashing'],
    };

    const intents = runReactions(state, event);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'DAMAGE',
      entityId: enemy.id,
      sourceEntityId: enemy.id,
      damage: 3,
      tags: ['damage.physical.slashing'],
    });
  });

  it('не срабатывает правило с hasStatus, если статус отсутствует', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'requires_burning',
          trigger: { event: 'ENTITY_DAMAGED' },
          conditions: [{ type: 'hasStatus', statusType: 'burning', subject: 'self' }],
          effect: { type: 'heal', amount: 5 },
          target: { type: 'self' },
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: [],
    };

    const intents = runReactions(state, event);
    expect(intents).toHaveLength(0);
  });

  it('соблюдает порядок слоёв source → target → world → radius', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'source_burn',
          priority: 10,
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
          effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
          target: { type: 'eventTarget' },
        }),
      ],
    });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'target_poison',
          priority: 5,
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
          effect: { type: 'applyStatus', statusType: 'poisoned', duration: 1 },
          target: { type: 'eventTarget' },
        }),
      ],
    });
    const bystander = makeEnemy({
      id: 'enemy_test_2',
      x: 5,
      y: 6,
      activeRules: [
        makeActiveRule({
          id: 'radius_frozen',
          priority: -5,
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
          effect: { type: 'applyStatus', statusType: 'frozen', duration: 1 },
          target: { type: 'eventTarget' },
        }),
      ],
    });

    const state = makeStateWithPlayerAndEntity(player, enemy);
    state.entities.set(bystander.id, bystander);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: ['damage.magical.fire'],
    };

    const intents = runReactions(state, event);
    const statusTypes = intents
      .filter((intent) => intent.type === 'APPLY_STATUS')
      .map((intent) => intent.status.type);

    // source (burning), target (poisoned), world (burning от world_global_fire_bonus), radius (frozen)
    expect(statusTypes).toEqual(['burning', 'poisoned', 'burning', 'frozen']);
  });

  it('не дублирует self-эффекты, когда source совпадает с target', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'self_burn',
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
          effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
          target: { type: 'self' },
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, player);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: player.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 5, y: 5 },
      tags: ['damage.magical.fire'],
    };

    const intents = runReactions(state, event);

    // source и target — один и тот же актор, activeRules должны быть собраны один раз.
    // Плюс мировое правило также срабатывает.
    expect(intents.filter((intent) => intent.type === 'APPLY_STATUS' && intent.status.type === 'burning')).toHaveLength(2);
  });

  it('разрешает collisionTarget в качестве цели', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'collision_burn',
          trigger: { event: 'ENTITY_COLLIDED' },
          effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
          target: { type: 'collisionTarget' },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_COLLIDED',
      entityId: player.id,
      targetId: enemy.id,
      collisionType: 'actor',
      sourceEntityId: null,
      position: { x: 6, y: 5 },
      dx: 1,
      dy: 0,
    };

    const intents = runReactions(state, event);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
    });
  });

  it('разрешает allInRadius и nearestEnemy селекторы', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'aoe_around_self',
          trigger: { event: 'ENTITY_DAMAGED' },
          effect: { type: 'dealDamage', amount: 2, tags: ['damage.magical.fire'] },
          target: { type: 'allInRadius', radius: 2, center: 'self', faction: 'enemy' },
        }),
        makeActiveRule({
          id: 'nearest_enemy_stab',
          priority: 1,
          trigger: { event: 'ENTITY_DAMAGED' },
          effect: { type: 'dealDamage', amount: 7, tags: ['damage.physical.slashing'] },
          target: { type: 'nearestEnemy', radius: 2, center: 'self' },
        }),
      ],
    });
    const enemyNear = makeEnemy({ id: 'enemy_near', x: 6, y: 5 });
    const enemyFar = makeEnemy({ id: 'enemy_far', x: 8, y: 5 });
    const ally = makeEnemy({ id: 'ally_test', x: 5, y: 4, factionId: 'player' });

    const state = makeStateWithPlayerAndEntity(player, enemyNear);
    state.entities.set(enemyFar.id, enemyFar);
    state.entities.set(ally.id, ally);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: player.id,
      sourceEntityId: enemyNear.id,
      damage: 3,
      position: { x: 5, y: 5 },
      tags: [],
    };

    const intents = runReactions(state, event);

    const aoeIntents = intents.filter((intent) => intent.type === 'DAMAGE' && intent.tags.includes('damage.magical.fire'));
    const nearestIntent = intents.find((intent) => intent.type === 'DAMAGE' && intent.tags.includes('damage.physical.slashing'));

    // allInRadius должен задеть enemyNear и ally, но ally той же фракции, поэтому только enemyNear
    expect(aoeIntents).toHaveLength(1);
    expect(aoeIntents[0]).toMatchObject({ entityId: enemyNear.id, damage: 2 });

    // nearestEnemy — ближайший враг
    expect(nearestIntent).toBeDefined();
    expect(nearestIntent).toMatchObject({ entityId: enemyNear.id, damage: 7 });
  });

  it('срабатывает глобальное мировое правило и применяет burning', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: ['damage.magical.fire'],
    };

    const intents = runReactions(state, event);

    const worldIntent = intents.find(
      (intent) =>
        intent.type === 'APPLY_STATUS' &&
        intent.status.type === 'burning' &&
        intent.status.duration === 1,
    );

    expect(worldIntent).toBeDefined();
    expect(worldIntent).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'burning', duration: 1, value: 0, statModifiers: null },
    });
  });

  it('не срабатывает при провале chance и срабатывает при успехе', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeActiveRule({
          id: 'chance_burn',
          trigger: { event: 'ENTITY_DAMAGED' },
          conditions: [{ type: 'chance', probability: 50 }],
          effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
          target: { type: 'eventTarget' },
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: enemy.id,
      sourceEntityId: player.id,
      damage: 5,
      position: { x: 6, y: 5 },
      tags: [],
    };

    vi.mocked(randomChance).mockReturnValue(false);
    expect(runReactions(state, event)).toHaveLength(0);

    vi.mocked(randomChance).mockReturnValue(true);
    expect(runReactions(state, event)).toHaveLength(1);
  });
});
