import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import type { Entity, EntityId, EnemyEntity } from '../../../src/simulation/types';
import type { ExecutionNode, GameEvent } from '../../../src/simulation/core-types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import { chebyshevDistance } from '../../../src/utils/math';
import { createDefaultAIState, getDerivedAIMode } from '../../../src/simulation/ai/ai-state';
import { registerSkill } from '../../../src/simulation/skills/skillExecutor';
import { testFireballSkill } from '../../helpers/test-skills';

beforeEach(() => {
  initSkillRegistry();
  registerSkill(testFireballSkill);
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    apCost: 2,
    ...overrides,
  } as AbilityTemplate;
}

function findEvents(node: ExecutionNode, type: GameEvent['type']): ExecutionNode[] {
  const results: ExecutionNode[] = [];
  if (node.event.type === type) {
    results.push(node);
  }
  for (const child of node.children) {
    results.push(...findEvents(child, type));
  }
  return results;
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
        ['test-fireball', mockAbility('test-fireball', { cooldown: 3, apCost: 2, aiPreparable: true })],
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
    expect(enemyAfter.aiState.preparedAbility).not.toBeNull();
    expect(getDerivedAIMode(enemyAfter)).toBe('prepared');
    expect(enemyAfter.aiState.preparedAbility?.abilityId).toBe('swoop');

    // Подготовка теперь — side-effect AI-стратегии: событие ABILITY_PREPARED
    // эмитится как child события ACTION_APPLIED (WAIT).
    const envPhase = result.phases.find((p) => p.side === 'ENVIRONMENT');
    expect(envPhase).toBeDefined();
    const waitNodes = envPhase!.actions.filter(
      (a) => a.event.type === 'ACTION_APPLIED' && a.event.action.type === 'WAIT',
    );
    expect(waitNodes.length).toBeGreaterThan(0);
    const preparedEvents = waitNodes.flatMap((n) => findEvents(n, 'ABILITY_PREPARED'));
    expect(preparedEvents.length).toBe(1);
    expect(preparedEvents[0]!.event).toMatchObject({
      type: 'ABILITY_PREPARED',
      entityId: enemyAfter.id,
      abilityId: 'swoop',
    });

    const target = enemyAfter.aiState.preparedAbility!.targets[0]!;
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
    const preparedTarget = getEnemy(sim.getState()).aiState.preparedAbility!.targets[0]!;
    expect(preparedTarget).toBeDefined();

    // Второй ход: выполнение скилла — босс прыгает в подготовленную точку.
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.x).toBe(preparedTarget.x);
    expect(enemyAfter.y).toBe(preparedTarget.y);
    expect(getDerivedAIMode(enemyAfter)).toBe('idle');
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
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
  });

  it('готовит дальнобойный preparable скилл, если игрок виден в зоне действия', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 9,
      y: 5,
      maxAp: 2,
      ap: 2,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedAbility).not.toBeNull();
    expect(enemyAfter.aiState.preparedAbility?.abilityId).toBe('test-fireball');
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
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
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
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
  });
});
