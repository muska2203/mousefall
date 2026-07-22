import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { counterattackSkill } from '../../../../src/simulation/skills/executors/counterattackSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { createTestSimulation } from '../../../helpers/simulation';
import { DefaultActionPointCostResolver } from '../../../../src/simulation/systems/action-cost-resolver';
import type { Actor, Entity, EntityId } from '../../../../src/simulation/types';
import { counterattackTriggerRule, counterattackDamageRule } from '../../../../src/simulation/content-rules/counterattack-rules';

vi.mock('../../../../src/utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

import { rngChance } from '../../../../src/utils/rng';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    tags: [],
    ...overrides,
  } as AbilityTemplate;
}

/**
 * Добавляет к актору активные правила контратаки, как если бы на него
 * был наложен статус counterattack из контентного реестра.
 */
function addCounterattackRules(actor: Actor): void {
  const ownerContext = { type: 'entity' as const, entityId: actor.id, statusInstanceId: 'counterattack_test' };
  actor.activeRules.push(
    { ...counterattackTriggerRule, ownerContext },
    { ...counterattackDamageRule, ownerContext },
  );
}

describe('counterattackSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['counterattack', mockAbility('counterattack', { cooldown: 4, apCost: 2, tags: ['target.self', 'buff.reactive'] })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
    vi.restoreAllMocks();
  });

  it('returns APPLY_STATUS with counterattack for 2 turns for player', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, ap: 3, maxAp: 3 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = counterattackSkill.resolve(state, player, [{ x: 5, y: 5 }]);

    expect(intents).toHaveLength(1);
    const applyStatus = intents.find(i => i.type === 'APPLY_STATUS');
    expect(applyStatus).toBeDefined();
    expect(applyStatus).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: {
        type: 'counterattack',
        duration: 2,
      },
    });
    expect(applyStatus!.status).not.toHaveProperty('stacks');
  });

  it('returns APPLY_STATUS with counterattack for 2 turns for enemy', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_counter', x: 6, y: 5, ap: 2, maxAp: 2 });
    state.entities.set(enemy.id, enemy);

    const intents = counterattackSkill.resolve(state, enemy, [{ x: 6, y: 5 }]);

    const applyStatus = intents.find(i => i.type === 'APPLY_STATUS');
    expect(applyStatus).toBeDefined();
    expect(applyStatus).toMatchObject({
      type: 'APPLY_STATUS',
      status: {
        type: 'counterattack',
        duration: 2,
      },
    });
  });

  it('has self target mode and valid target at caster position', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    expect(counterattackSkill.getTargetMode(state, player)).toEqual({ type: 'self' });
    expect(counterattackSkill.getValidTargets(state, player)).toEqual([{ x: 5, y: 5 }]);
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('counterattack')).toBeDefined();
  });

  it('cost resolver returns 2 AP for counterattack', () => {
    const state = makeGameState();
    const player = makePlayer({ ap: 3, maxAp: 3 });
    state.player = player;
    state.entities.set(player.id, player);

    const resolver = new DefaultActionPointCostResolver();
    const cost = resolver.getCost({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'counterattack', targets: [{ x: 5, y: 5 }] }, state);
    expect(cost).toBe(2);
  });
});

describe('counterattack combat behavior', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['counterattack', mockAbility('counterattack', { cooldown: 4, apCost: 2, tags: ['target.self', 'buff.reactive'] })],
        ['sudden_strike', mockAbility('sudden_strike', { cooldown: 2, apCost: 1, tags: ['attack.melee', 'target.single', 'delivery.weapon'] })],
        ['magic_slap', mockAbility('magic_slap', { cooldown: 2, apCost: 1, tags: ['attack.ranged', 'target.multi', 'delivery.spell'] })],
        ['cleave', mockAbility('cleave', { cooldown: 2, apCost: 1, damageTag: 'damage.physical.slashing', tags: ['attack.melee', 'target.aoe', 'delivery.weapon'] })],
        ['fireball', mockAbility('fireball', { cooldown: 3, apCost: 2, tags: ['attack.ranged', 'target.aoe', 'delivery.projectile', 'delivery.spell', 'effect.burn'] })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
    vi.mocked(rngChance).mockReturnValue(true);
  });

  afterEach(() => {
    resetRegistry();
    vi.restoreAllMocks();
  });

  it('incoming damage goes through and counterattack triggers on 50% chance', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, ap: 2, maxAp: 2, baseStats: { str: 5, dex: 0, int: 0, vit: 0 } });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      ap: 1,
      maxAp: 1,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemy);
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    // Враг получает урон от обычной атаки.
    expect(enemy.hp).toBeLessThan(100);
    // Игрок получает урон от контратаки.
    expect(player.hp).toBeLessThan(100);
    // Эффект контратаки остаётся на враге.
    expect(enemy.statusEffects.some(e => e.type === 'counterattack')).toBe(true);
  });

  it('no counterattack damage when 50% chance fails', () => {
    vi.mocked(rngChance).mockReturnValue(false);

    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, ap: 2, maxAp: 2, baseStats: { str: 5, dex: 0, int: 0, vit: 0 } });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      ap: 1,
      maxAp: 1,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemy);
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    expect(enemy.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);
    expect(enemy.statusEffects.some(e => e.type === 'counterattack')).toBe(true);
  });

  it('player counterattacks enemy when enemy attacks player with counterattack active', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 1,
      maxAp: 1,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(player);
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100, armor: 0, ap: 2, maxAp: 2, baseStats: { str: 5, dex: 0, int: 0, vit: 0 } });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = GameSimulation.loadSavedGame(state);
    (sim as any).turnState = { phase: 'actor-turn', factionId: 'enemies', actorId: enemy.id };
    sim.dispatch({ type: 'ATTACK', entityId: enemy.id, dx: -1, dy: 0 });

    // Игрок получает урон от обычной атаки врага.
    expect(player.hp).toBeLessThan(100);
    // Враг получает урон от контратаки игрока.
    expect(enemy.hp).toBeLessThan(100);
    // Эффект контратаки остаётся на игроке.
    expect(player.statusEffects.some(e => e.type === 'counterattack')).toBe(true);
  });

  it('counterattack triggers on sudden_strike melee single-target weapon damage', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'sudden_strike', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemy);
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'sudden_strike', targets: [{ x: 6, y: 5 }] });

    // Враг получает урон от скилла.
    expect(enemy.hp).toBeLessThan(100);
    // Игрок получает урон от контратаки.
    expect(player.hp).toBeLessThan(100);
  });

  it('counterattack does not trigger on ranged spell damage from magic_slap', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      baseStats: { str: 5, dex: 0, int: 5, vit: 0 },
      abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemyCounter = makeEnemy({
      id: 'enemy_counter',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemyCounter);
    const enemyExtra1 = makeEnemy({ id: 'enemy_extra_1', x: 5, y: 6, hp: 100, maxHp: 100, armor: 0 });
    const enemyExtra2 = makeEnemy({ id: 'enemy_extra_2', x: 4, y: 5, hp: 100, maxHp: 100, armor: 0 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemyCounter.id, enemyCounter],
        [enemyExtra1.id, enemyExtra1],
        [enemyExtra2.id, enemyExtra2],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'magic_slap', targets: [{ x: 6, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 5 }] });

    // Урон от ranged-скилла не считается подходящей атакой — контратака не срабатывает.
    expect(enemyCounter.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);
    expect(enemyCounter.statusEffects.some(e => e.type === 'counterattack')).toBe(true);
  });

  it('counterattack does not trigger on cleave AoE melee damage', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemy);
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'cleave', targets: [{ x: 6, y: 5 }] });

    // AoE-урон не считается одиночной целью — контратака не срабатывает.
    expect(enemy.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);
  });

  it('counterattack does not trigger on fireball ranged AoE damage', () => {
    vi.mocked(rngChance).mockReturnValue(true);

    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 4,
      maxAp: 4,
      baseStats: { str: 5, dex: 0, int: 5, vit: 0 },
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 7,
      y: 5,
      hp: 100,
      maxHp: 100,
      armor: 0,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    addCounterattackRules(enemy);
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'fireball', targets: [{ x: 7, y: 5 }] });

    // Дальний AoE-урон не провоцирует контратаку.
    expect(enemy.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);
  });
});
