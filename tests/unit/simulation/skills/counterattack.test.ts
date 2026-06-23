import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { counterattackSkill } from '../../../../src/simulation/skills/executors/counterattackSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../../src/simulation/simulation';
import { DefaultActionPointCostResolver } from '../../../../src/simulation/systems/action-cost-resolver';
import type { Entity, EntityId } from '../../../../src/simulation/types';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('counterattackSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['counterattack', mockAbility('counterattack', { cooldown: 0, apCost: 'all' })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('returns APPLY_STATUS with stacks equal to caster AP and tickAfter environment for player', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, ap: 3, maxAp: 3 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = counterattackSkill.resolve(state, player, [{ x: 5, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: {
        type: 'counterattack',
        duration: 1,
        stacks: 3,
        tickAfter: 'environment',
      },
    });
  });

  it('returns APPLY_STATUS with tickAfter player for enemy', () => {
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
        stacks: 2,
        tickAfter: 'player',
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

  it('cost resolver returns all AP for counterattack', () => {
    const state = makeGameState();
    const player = makePlayer({ ap: 4, maxAp: 4 });
    state.player = player;
    state.entities.set(player.id, player);

    const resolver = new DefaultActionPointCostResolver();
    const cost = resolver.getCost({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'counterattack', targets: [{ x: 5, y: 5 }] }, state);
    expect(cost).toBe(4);
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
        ['counterattack', mockAbility('counterattack', { cooldown: 0, apCost: 'all' })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('enemy counterattacks player when player attacks enemy with counterattack active', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, ap: 2, maxAp: 2 });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 1,
      maxAp: 1,
      statusEffects: [{ type: 'counterattack', duration: 1, value: 0, statModifiers: null, stacks: 1, tickAfter: 'player' }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    // Игрок должен получить урон от контратаки, враг — нет.
    expect(player.hp).toBeLessThan(100);
    expect(enemy.hp).toBe(100);

    // Статус контратаки снят, так как стаки достигли 0.
    expect(enemy.statusEffects.some(e => e.type === 'counterattack')).toBe(false);
  });

  it('player counterattacks enemy when enemy attacks player with counterattack active', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 100,
      ap: 1,
      maxAp: 1,
      statusEffects: [{ type: 'counterattack', duration: 1, value: 0, statModifiers: null, stacks: 2, tickAfter: 'environment' }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100, ap: 2, maxAp: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });
    // Ход окружения, чтобы враг мог атаковать.
    state.turn.activeSide = 'ENVIRONMENT';

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: enemy.id, dx: -1, dy: 0 });

    // Враг должен получить урон от контратаки, игрок — нет.
    expect(enemy.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);

    // Стаки контратаки уменьшились на 1.
    const counterattack = player.statusEffects.find(e => e.type === 'counterattack');
    expect(counterattack).toBeDefined();
    expect(counterattack!.stacks).toBe(1);
  });

  it('normal attack damages target when no counterattack', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, ap: 2, maxAp: 2 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100, armor: 0 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    expect(enemy.hp).toBeLessThan(100);
    expect(player.hp).toBe(100);
  });

  it('counterattack does not trigger on skill damage', () => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['counterattack', mockAbility('counterattack', { cooldown: 0, apCost: 'all' })],
        ['magic_slap', mockAbility('magic_slap', { cooldown: 0, apCost: 1 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });

    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, ap: 3, maxAp: 3, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      statusEffects: [{ type: 'counterattack', duration: 1, value: 0, statModifiers: null, stacks: 1, tickAfter: 'player' }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    sim.dispatch({ type: 'USE_ABILITY', entityId: player.id, abilityId: 'magic_slap', targets: [{ x: 6, y: 5 }] });

    // Magic slap не является прямой атакой оружием, контратака не срабатывает.
    // Игрок не получает урона от контратаки.
    expect(player.hp).toBe(100);
    // Статус контратаки у врага остаётся нетронутым.
    expect(enemy.statusEffects.some(e => e.type === 'counterattack')).toBe(true);
  });
});
