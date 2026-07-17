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
import {setWorldContentRulesOverride} from '../../../../../src/simulation/content-rules/rules';
import { ExecutionBuilder } from '../../../../../src/simulation/core-types';
import type { GameEvent, Intent } from '../../../../../src/simulation/core-types';
import type { ActiveRule, WorldContentRule } from '../../../../../src/simulation/content-rules/types';
import { counterattackTriggerRule, counterattackDamageRule } from '../../../../../src/simulation/content-rules/counterattack-rules';

vi.mock('../../../../../src/utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

import { rngChance } from '../../../../../src/utils/rng';

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
    vi.mocked(rngChance).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    setWorldContentRulesOverride(null);
  });

  describe('RULE_TRIGGERED observability', () => {
    it('эмитит RULE_TRIGGERED как child исходного события при срабатывании правила', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_test_1',
        x: 6,
        y: 5,
        activeRules: [
          makeActiveRule({
            id: 'target_burn_rule',
            trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.physical.slashing'] },
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
        tags: ['damage.physical.slashing'],
      };
      const builder = new ExecutionBuilder(event);

      runContentRuleReactions(state, event, builder, builder.root);

      const triggeredNodes = builder.root.children.filter((child) => child.event.type === 'RULE_TRIGGERED');
      expect(triggeredNodes).toHaveLength(1);

      const ruleEvent = triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>;
      expect(ruleEvent.ruleId).toBe('target_burn_rule');
      expect(ruleEvent.layer).toBe('target');
      expect(ruleEvent.ownerEntityId).toBe(enemy.id);
      expect(ruleEvent.triggerEventType).toBe('ENTITY_DAMAGED');
      expect(ruleEvent.triggerTags).toEqual(['damage.physical.slashing']);
      expect(ruleEvent.conditionMatched).toBe(true);
      expect(ruleEvent.intents).toHaveLength(1);
      expect(ruleEvent.intents[0]).toMatchObject({ type: 'APPLY_STATUS' });
    });

    it('RULE_TRIGGERED от мирового правила имеет layer world и ownerEntityId null', () => {
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
      const builder = new ExecutionBuilder(event);

      runContentRuleReactions(state, event, builder, builder.root);

      const worldRuleEvent = builder.root.children
        .map((child) => child.event)
        .find((e): e is Extract<GameEvent, { type: 'RULE_TRIGGERED' }> => e.type === 'RULE_TRIGGERED' && e.layer === 'world');

      expect(worldRuleEvent).toBeDefined();
      expect(worldRuleEvent!.ruleId).toBe('fire_damage_ignites');
      expect(worldRuleEvent!.ownerEntityId).toBeNull();
    });

    it('не изменяет игровое состояние при генерации RULE_TRIGGERED', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_test_1',
        x: 6,
        y: 5,
        hp: 100,
        activeRules: [
          makeActiveRule({
            id: 'target_burn_rule',
            effect: { type: 'applyStatus', statusType: 'burning', duration: 1 },
            target: { type: 'eventTarget' },
          }),
        ],
      });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      const hpBefore = enemy.hp;
      const statusesBefore = [...enemy.statusEffects];

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: [],
      };
      const builder = new ExecutionBuilder(event);

      runContentRuleReactions(state, event, builder, builder.root);

      expect(enemy.hp).toBe(hpBefore);
      expect(enemy.statusEffects).toEqual(statusesBefore);
    });
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
      sourceEntityId: enemy.id,
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
          id: 'radius_silenced',
          priority: -5,
          trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
          effect: { type: 'applyStatus', statusType: 'silenced', duration: 1 },
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

    // source (burning), target (poisoned), world (burning от fire_damage_ignites), radius (silenced)
    expect(statusTypes).toEqual(['burning', 'poisoned', 'burning', 'silenced']);
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
      tags: [],
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
        intent.status.duration === 3,
    );

    expect(worldIntent).toBeDefined();
    expect(worldIntent).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'burning', duration: 3, value: 0, statModifiers: null },
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

    vi.mocked(rngChance).mockReturnValue(false);
    expect(runReactions(state, event)).toHaveLength(0);

    vi.mocked(rngChance).mockReturnValue(true);
    expect(runReactions(state, event)).toHaveLength(1);
  });

  describe('мировое правило тика горения', () => {
    it('при STATUS_TICKED с тегом status.burning порождает fire DAMAGE от мира', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5, hp: 100, maxHp: 100 });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'STATUS_TICKED',
        entityId: enemy.id,
        effectTypes: ['burning'],
        tags: ['status.burning'],
      };

      const intents = runReactions(state, event);

      const damage = intents.find((intent) => intent.type === 'DAMAGE');
      expect(damage).toBeDefined();
      expect(damage).toMatchObject({
        entityId: enemy.id,
        sourceEntityId: null,
        damage: Math.max(1, Math.round(enemy.maxHp * 0.1)),
        tags: expect.arrayContaining(['damage.magical.fire']),
      });
    });
  });

  describe('порядок мировых правил в слое world', () => {
    afterEach(() => {
      setWorldContentRulesOverride(null);
    });

    it('соблюдает порядок global → tileEffect → tileIntrinsic независимо от priority', () => {
      const player = makePlayer({x: 5, y: 5});
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const tileIntrinsicRule: WorldContentRule = {
        id: 'tile_intrinsic_rule',
        trigger: {event: 'ENTITY_DAMAGED'},
        effect: {type: 'applyStatus', statusType: 'frozen', duration: 1},
        target: {type: 'eventTarget'},
        priority: -100,
        ownerContext: {type: 'world'},
        worldLayer: 'tileIntrinsic',
      };
      const tileEffectRule: WorldContentRule = {
        id: 'tile_effect_rule',
        trigger: {event: 'ENTITY_DAMAGED'},
        effect: {type: 'applyStatus', statusType: 'poisoned', duration: 1},
        target: {type: 'eventTarget'},
        priority: 100,
        ownerContext: {type: 'world'},
        worldLayer: 'tileEffect',
      };
      const globalRule: WorldContentRule = {
        id: 'global_rule',
        trigger: {event: 'ENTITY_DAMAGED'},
        effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
        target: {type: 'eventTarget'},
        priority: 0,
        ownerContext: {type: 'world'},
        worldLayer: 'global',
      };

      setWorldContentRulesOverride([tileIntrinsicRule, tileEffectRule, globalRule]);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: {x: 6, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      const statusTypes = intents
        .filter((intent): intent is Extract<Intent, {type: 'APPLY_STATUS'}> => intent.type === 'APPLY_STATUS')
        .map((intent) => intent.status.type);

      expect(statusTypes).toEqual(['burning', 'poisoned', 'frozen']);
    });

    it('использует tie-break по ruleId при равных worldLayer и priority', () => {
      const player = makePlayer({x: 5, y: 5});
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const ruleB: WorldContentRule = {
        id: 'world_b_rule',
        trigger: {event: 'ENTITY_DAMAGED'},
        effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
        target: {type: 'eventTarget'},
        priority: 0,
        ownerContext: {type: 'world'},
        worldLayer: 'global',
      };
      const ruleA: WorldContentRule = {
        id: 'world_a_rule',
        trigger: {event: 'ENTITY_DAMAGED'},
        effect: {type: 'applyStatus', statusType: 'poisoned', duration: 1},
        target: {type: 'eventTarget'},
        priority: 0,
        ownerContext: {type: 'world'},
        worldLayer: 'global',
      };

      setWorldContentRulesOverride([ruleB, ruleA]);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: {x: 6, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      const statusTypes = intents
        .filter((intent): intent is Extract<Intent, {type: 'APPLY_STATUS'}> => intent.type === 'APPLY_STATUS')
        .map((intent) => intent.status.type);

      expect(statusTypes).toEqual(['poisoned', 'burning']);
    });
  });

  describe('селектор allInRadius', () => {
    it('включает владельца без excludeSelf и исключает при excludeSelf: true', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        factionId: 'player',
        activeRules: [
          makeActiveRule({
            id: 'aoe_include_self',
            trigger: {event: 'ENTITY_DAMAGED'},
            effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
            target: {type: 'allInRadius', radius: 1, center: 'self'},
          }),
          makeActiveRule({
            id: 'aoe_exclude_self',
            priority: 1,
            trigger: {event: 'ENTITY_DAMAGED'},
            effect: {type: 'applyStatus', statusType: 'poisoned', duration: 1},
            target: {type: 'allInRadius', radius: 1, center: 'self', excludeSelf: true},
          }),
        ],
      });
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: player.id,
        sourceEntityId: enemy.id,
        damage: 5,
        position: {x: 5, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      const includeSelfIntents = intents.filter(
        (intent) => intent.type === 'APPLY_STATUS' && intent.status.type === 'burning',
      );
      const excludeSelfIntents = intents.filter(
        (intent) => intent.type === 'APPLY_STATUS' && intent.status.type === 'poisoned',
      );

      expect(
        includeSelfIntents
          .map((intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId)
          .sort(),
      ).toEqual([player.id, enemy.id].sort());
      expect(
        excludeSelfIntents.map((intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId),
      ).toEqual([enemy.id]);
    });

    it('с faction: enemy исключает владельца той же фракции', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        factionId: 'player',
        activeRules: [
          makeActiveRule({
            id: 'aoe_enemy_only',
            trigger: {event: 'ENTITY_DAMAGED'},
            effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
            target: {type: 'allInRadius', radius: 1, center: 'self', faction: 'enemy'},
          }),
        ],
      });
      const ally = makeEnemy({id: 'ally_test', x: 5, y: 6, factionId: 'player'});
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.entities.set(ally.id, ally);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: player.id,
        sourceEntityId: enemy.id,
        damage: 5,
        position: {x: 5, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({entityId: enemy.id});
    });

    it('не включает мёртвых акторов', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        activeRules: [
          makeActiveRule({
            id: 'aoe_all_alive',
            trigger: {event: 'ENTITY_DAMAGED'},
            effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
            target: {type: 'allInRadius', radius: 2, center: 'self'},
          }),
        ],
      });
      const aliveEnemy = makeEnemy({id: 'alive_enemy', x: 6, y: 5});
      const deadEnemy = makeEnemy({id: 'dead_enemy', x: 5, y: 6, isAlive: false});
      const state = makeStateWithPlayerAndEntity(player, aliveEnemy);
      state.entities.set(deadEnemy.id, deadEnemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: player.id,
        sourceEntityId: aliveEnemy.id,
        damage: 5,
        position: {x: 5, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      expect(
        intents
          .map((intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId)
          .sort(),
      ).toEqual([player.id, aliveEnemy.id].sort());
    });

    it('возвращает цели в детерминированном порядке по id независимо от порядка entities', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        activeRules: [
          makeActiveRule({
            id: 'aoe_deterministic',
            trigger: {event: 'ENTITY_DAMAGED'},
            effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
            target: {type: 'allInRadius', radius: 2, center: 'self'},
          }),
        ],
      });
      const enemyA = makeEnemy({id: 'enemy_a', x: 6, y: 5});
      const enemyB = makeEnemy({id: 'enemy_b', x: 5, y: 6});

      const state1 = makeStateWithPlayerAndEntity(player, enemyA);
      state1.entities.set(enemyB.id, enemyB);

      const state2 = makeStateWithPlayerAndEntity(player, enemyB);
      state2.entities.set(enemyA.id, enemyA);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: player.id,
        sourceEntityId: enemyA.id,
        damage: 5,
        position: {x: 5, y: 5},
        tags: [],
      };

      const ids1 = runReactions(state1, event).map(
        (intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId,
      );
      const ids2 = runReactions(state2, event).map(
        (intent) => (intent as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId,
      );

      expect(ids1).toEqual(ids2);
      expect(ids1).toEqual([player.id, enemyA.id, enemyB.id].sort());
    });

    it('применяет targetConditions отдельно для каждой цели', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        activeRules: [
          makeActiveRule({
            id: 'aoe_only_burning_targets',
            trigger: {event: 'ENTITY_DAMAGED'},
            targetConditions: [{type: 'hasStatus', statusType: 'burning', subject: 'candidate'}],
            effect: {type: 'dealDamage', amount: 3, tags: ['damage.magical.fire']},
            target: {type: 'allInRadius', radius: 2, center: 'self'},
          }),
        ],
      });
      const burningEnemy = makeEnemy({
        id: 'burning_enemy',
        x: 6,
        y: 5,
        statusEffects: [{type: 'burning', duration: 1, value: 1, statModifiers: null}],
      });
      const normalEnemy = makeEnemy({id: 'normal_enemy', x: 5, y: 6});
      const state = makeStateWithPlayerAndEntity(player, burningEnemy);
      state.entities.set(normalEnemy.id, normalEnemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: player.id,
        sourceEntityId: burningEnemy.id,
        damage: 5,
        position: {x: 5, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({entityId: burningEnemy.id, damage: 3});
    });
  });

  describe('мировые правила столкновений', () => {
    it('столкновение со стеной наносит урон и накладывает dazed на отталкиваемого актора', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_COLLIDED',
        entityId: enemy.id,
        targetId: null,
        collisionType: 'wall',
        sourceEntityId: player.id,
        position: { x: 6, y: 5 },
        dx: 1,
        dy: 0,
        tags: ['displacement.push', 'collision.wall'],
      };

      const intents = runReactions(state, event);

      expect(intents).toHaveLength(2);

      const damage = intents.find((intent) => intent.type === 'DAMAGE');
      expect(damage).toMatchObject({
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        tags: ['delivery.movement', 'damage.physical.blunt'],
      });

      const dazed = intents.find(
        (intent) => intent.type === 'APPLY_STATUS' && intent.status.type === 'dazed',
      );
      expect(dazed).toMatchObject({
        entityId: enemy.id,
        status: { type: 'dazed', duration: 2, value: 0, statModifiers: null },
      });
    });

    it('столкновение с другим актором затрагивает оба актора', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const pushed = makeEnemy({ id: 'enemy_pushed', x: 6, y: 5 });
      const target = makeEnemy({ id: 'enemy_target', x: 7, y: 5 });
      const state = makeStateWithPlayerAndEntity(player, pushed);
      state.entities.set(target.id, target);

      const event: GameEvent = {
        type: 'ENTITY_COLLIDED',
        entityId: pushed.id,
        targetId: target.id,
        collisionType: 'actor',
        sourceEntityId: player.id,
        position: { x: 6, y: 5 },
        dx: 1,
        dy: 0,
        tags: ['displacement.push', 'collision.actor'],
      };

      const intents = runReactions(state, event);

      const damageIntents = intents.filter(
        (intent): intent is Extract<Intent, { type: 'DAMAGE' }> => intent.type === 'DAMAGE',
      );
      expect(damageIntents).toHaveLength(2);
      expect(damageIntents.map((intent) => intent.entityId).sort()).toEqual(
        [pushed.id, target.id].sort(),
      );
      expect(damageIntents.every((intent) => intent.sourceEntityId === player.id)).toBe(true);

      const dazedIntents = intents.filter(
        (intent): intent is Extract<Intent, { type: 'APPLY_STATUS' }> =>
          intent.type === 'APPLY_STATUS' && intent.status.type === 'dazed',
      );
      expect(dazedIntents).toHaveLength(2);
      expect(dazedIntents.map((intent) => intent.entityId).sort()).toEqual(
        [pushed.id, target.id].sort(),
      );
    });
  });

  describe('порядок мировых правил в слое world', () => {
    afterEach(() => {
      setWorldContentRulesOverride(null);
    });

    it('соблюдает порядок global → tileEffect → tileIntrinsic независимо от priority', () => {
      const player = makePlayer({x: 5, y: 5});
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);

      setWorldContentRulesOverride([
        {
          id: 'tile_intrinsic_rule',
          trigger: {event: 'ENTITY_DAMAGED'},
          effect: {type: 'applyStatus', statusType: 'frozen', duration: 1},
          target: {type: 'eventTarget'},
          priority: -100,
          ownerContext: {type: 'world'},
          worldLayer: 'tileIntrinsic',
        },
        {
          id: 'global_rule',
          trigger: {event: 'ENTITY_DAMAGED'},
          effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
          target: {type: 'eventTarget'},
          priority: 100,
          ownerContext: {type: 'world'},
          worldLayer: 'global',
        },
        {
          id: 'tile_effect_rule',
          trigger: {event: 'ENTITY_DAMAGED'},
          effect: {type: 'applyStatus', statusType: 'silenced', duration: 1},
          target: {type: 'eventTarget'},
          priority: -50,
          ownerContext: {type: 'world'},
          worldLayer: 'tileEffect',
        },
      ]);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 1,
        position: {x: 6, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      const statusTypes = intents
        .filter((intent) => intent.type === 'APPLY_STATUS')
        .map((intent) => intent.status.type);

      expect(statusTypes).toEqual(['burning', 'silenced', 'frozen']);
    });

    it('при равных worldLayer и priority использует tie-break по ruleId', () => {
      const player = makePlayer({x: 5, y: 5});
      const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
      const state = makeStateWithPlayerAndEntity(player, enemy);

      setWorldContentRulesOverride([
        {
          id: 'global_b',
          trigger: {event: 'ENTITY_DAMAGED'},
          effect: {type: 'applyStatus', statusType: 'poisoned', duration: 1},
          target: {type: 'eventTarget'},
          priority: 0,
          ownerContext: {type: 'world'},
          worldLayer: 'global',
        },
        {
          id: 'global_a',
          trigger: {event: 'ENTITY_DAMAGED'},
          effect: {type: 'applyStatus', statusType: 'burning', duration: 1},
          target: {type: 'eventTarget'},
          priority: 0,
          ownerContext: {type: 'world'},
          worldLayer: 'global',
        },
      ]);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 1,
        position: {x: 6, y: 5},
        tags: [],
      };

      const intents = runReactions(state, event);
      const statusTypes = intents
        .filter((intent) => intent.type === 'APPLY_STATUS')
        .map((intent) => intent.status.type);

      expect(statusTypes).toEqual(['burning', 'poisoned']);
    });
  });

  describe('контратака', () => {
    function makeCounterattackActiveRule(rule: typeof counterattackTriggerRule | typeof counterattackDamageRule, ownerId: string): ActiveRule {
      return {
        ...rule,
        ownerContext: { type: 'entity', entityId: ownerId, statusInstanceId: 'counterattack_test' },
      };
    }

    it('counterattack_trigger срабатывает на ближний одиночный урон оружием при наличии статуса и успехе шанса', () => {
      const player = makePlayer({ id: 'player', x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_counter',
        x: 6,
        y: 5,
        statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
        activeRules: [
          makeCounterattackActiveRule(counterattackTriggerRule, 'enemy_counter'),
          makeCounterattackActiveRule(counterattackDamageRule, 'enemy_counter'),
        ],
      });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: ['attack.melee', 'target.single', 'delivery.weapon'],
      };

      const intents = runReactions(state, event);

      expect(intents).toHaveLength(1);
      expect(intents[0]).toEqual({
        type: 'COUNTER_ATTACK',
        counterAttackerId: enemy.id,
        targetId: player.id,
        dx: -1,
        dy: 0,
      });
    });

    it('counterattack_trigger не срабатывает на дальний или множественный урон', () => {
      const player = makePlayer({ id: 'player', x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_counter',
        x: 6,
        y: 5,
        statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
        activeRules: [
          makeCounterattackActiveRule(counterattackTriggerRule, 'enemy_counter'),
          makeCounterattackActiveRule(counterattackDamageRule, 'enemy_counter'),
        ],
      });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: ['attack.ranged', 'target.multi', 'delivery.spell'],
      };

      const intents = runReactions(state, event);

      expect(intents.filter((intent) => intent.type === 'COUNTER_ATTACK')).toHaveLength(0);
    });

    it('counterattack_trigger не срабатывает без статуса counterattack', () => {
      const player = makePlayer({ id: 'player', x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_counter',
        x: 6,
        y: 5,
        activeRules: [makeCounterattackActiveRule(counterattackTriggerRule, 'enemy_counter')],
      });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: ['attack.melee', 'target.single', 'delivery.weapon'],
      };

      const intents = runReactions(state, event);

      expect(intents.filter((intent) => intent.type === 'COUNTER_ATTACK')).toHaveLength(0);
    });

    it('counterattack_trigger не срабатывает при провале шанса', () => {
      vi.mocked(rngChance).mockReturnValue(false);

      const player = makePlayer({ id: 'player', x: 5, y: 5 });
      const enemy = makeEnemy({
        id: 'enemy_counter',
        x: 6,
        y: 5,
        statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
        activeRules: [makeCounterattackActiveRule(counterattackTriggerRule, 'enemy_counter')],
      });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: ['attack.melee', 'target.single', 'delivery.weapon'],
      };

      const intents = runReactions(state, event);

      expect(intents).toHaveLength(0);
    });

    it('counterattack_trigger не срабатывает, когда владелец является источником урона', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
        activeRules: [
          makeCounterattackActiveRule(counterattackTriggerRule, 'player'),
          makeCounterattackActiveRule(counterattackDamageRule, 'player'),
        ],
      });
      const enemy = makeEnemy({ id: 'enemy_target', x: 6, y: 5 });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        position: { x: 6, y: 5 },
        tags: ['attack.melee', 'target.single', 'delivery.weapon'],
      };

      const intents = runReactions(state, event);

      expect(intents.filter((intent) => intent.type === 'COUNTER_ATTACK')).toHaveLength(0);
    });

    it('counterattack_damage создаёт DAMAGE-интент с уроном из события', () => {
      const player = makePlayer({
        id: 'player',
        x: 5,
        y: 5,
        activeRules: [makeCounterattackActiveRule(counterattackDamageRule, 'player')],
      });
      const enemy = makeEnemy({ id: 'enemy_target', x: 6, y: 5 });
      const state = makeStateWithPlayerAndEntity(player, enemy);

      const event: GameEvent = {
        type: 'COUNTER_ATTACK_APPLIED',
        attackerId: player.id,
        targetId: enemy.id,
        dx: 1,
        dy: 0,
        damage: 17,
        tags: ['reaction.counter'],
      };

      const intents = runReactions(state, event);

      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 17,
        tags: ['reaction.counter'],
      });
    });
  });
});
