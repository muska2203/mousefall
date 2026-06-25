import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import type { Entity, EntityId, EnemyEntity } from '../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import { chebyshevDistance } from '../../../src/utils/math';
import { createDefaultAIState } from '../../../src/simulation/ai/ai-state';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    apCost: 2,
    ...overrides,
  } as AbilityTemplate;
}

function getEnemy(state: ReturnType<typeof makeGameState>): EnemyEntity {
  for (const entity of state.entities.values()) {
    if (entity.type === 'enemy') return entity as EnemyEntity;
  }
  throw new Error('Враг не найден в состоянии');
}

describe('AI: simple-boss', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['swoop', mockAbility('swoop', { cooldown: 2, apCost: 2, aiPreparable: true })],
        ['fireball', mockAbility('fireball', { cooldown: 3, apCost: 2, aiPreparable: true })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('готовит налёт, если игрок виден в пределах 2 клеток', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 7,
      y: 5,
      maxAp: 2,
      ap: 2,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).not.toBeNull();
    expect(enemyAfter.aiState.preparedIntent?.abilityId).toBe('swoop');

    const target = enemyAfter.aiState.preparedIntent!.fixedTargets[0]!;
    expect(chebyshevDistance(target, { x: player.x, y: player.y })).toBeLessThanOrEqual(1);
  });

  it('выполняет подготовленный налёт в начале следующего хода AI', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1, hp: 100, maxHp: 100 });
    const enemy = makeEnemy({
      x: 7,
      y: 5,
      maxAp: 2,
      ap: 2,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Первый ход: подготовка.
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    const preparedTarget = getEnemy(sim.getState()).aiState.preparedIntent!.fixedTargets[0]!;
    expect(preparedTarget).toBeDefined();

    // Второй ход: выполнение скилла — босс прыгает в подготовленную точку.
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.x).toBe(preparedTarget.x);
    expect(enemyAfter.y).toBe(preparedTarget.y);
    expect(chebyshevDistance(enemyAfter, { x: player.x, y: player.y })).toBeLessThanOrEqual(2);
  });

  it('не готовит скилл, если ни одна валидная клетка не достаёт до игрока', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 9,
      y: 5,
      maxAp: 1,
      ap: 1,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
  });

  it('готовит дальнобойный preparable скилл, если игрок виден в зоне действия', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 9,
      y: 5,
      maxAp: 1,
      ap: 1,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).not.toBeNull();
    expect(enemyAfter.aiState.preparedIntent?.abilityId).toBe('fireball');
  });

  it('не готовит налёт, если скилл на кулдауне', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 7,
      y: 5,
      maxAp: 1,
      ap: 1,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 2 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
  });

  it('не готовит налёт, если нет прямой видимости на игрока', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 7,
      y: 5,
      maxAp: 1,
      ap: 1,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    // Стена блокирует линию обзора между врагом и игроком.
    state.map.tiles[5]![6] = 'wall';

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
  });
});
