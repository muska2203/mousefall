import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import type { Entity, EntityId, EnemyEntity } from '../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import { tryPrepareAbility } from '../../../src/simulation/ai/ai-helpers';
import { getDerivedAIMode } from '../../../src/simulation/ai/ai-state';
import { getAbility } from '../../../src/content/registry';
import { registerSkill } from '../../../src/simulation/skills/skillExecutor';
import { testFireballSkill } from '../../helpers/test-skills';

beforeEach(() => {
  initSkillRegistry();
  registerSkill(testFireballSkill);
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

function getEnemy(state: ReturnType<typeof makeGameState>): EnemyEntity {
  for (const entity of state.entities.values()) {
    if (entity.type === 'enemy') return entity as EnemyEntity;
  }
  throw new Error('Враг не найден в состоянии');
}

describe('AI: подготовка скилла (AI-Delayed Intent)', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['test-fireball', mockAbility('test-fireball', { aiPreparable: true, apCost: 2 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('не подготавливает скилл, если maxAp меньше apCost', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 1,
      ap: 1,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfterTurn = getEnemy(sim.getState());
    expect(enemyAfterTurn.aiState.preparedIntent).toBeNull();
    expect(getDerivedAIMode(enemyAfterTurn)).not.toBe('prepared');
  });

  it('видит игрока и подготавливает preparable скилл', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Игрок завершает ход, запускается ход окружения
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfterTurn = getEnemy(sim.getState());
    expect(enemyAfterTurn.aiState.preparedIntent).not.toBeNull();
    expect(getDerivedAIMode(enemyAfterTurn)).toBe('prepared');
    expect(enemyAfterTurn.aiState.preparedIntent?.abilityId).toBe('test-fireball');
    expect(enemyAfterTurn.aiState.preparedIntent?.fixedTargets).toEqual([{ x: 5, y: 5 }]);

    // Зона поражения не хранится в AIState, но доступна через публичный API Simulation.
    const affectedPositions = sim.getAbilityAffectedPositions(
      'test-fireball',
      enemyAfterTurn.id,
      [{ x: 5, y: 5 }],
      { x: 5, y: 5 },
    );
    expect(affectedPositions).toEqual([
      { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
      { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ]);
  });

  it('выполняет подготовленный скилл в начале следующего хода AI', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1, hp: 100, maxHp: 100 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Первый ход: подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedIntent).not.toBeNull();

    // Второй ход: выполнение
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
    expect(getDerivedAIMode(enemyAfter)).toBe('chase');
    // Игрок получил урон от fireball
    expect(sim.getState().player.hp).toBeLessThan(100);
  });

  it('сбрасывает подготовку при оглушении', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedIntent).not.toBeNull();

    // Игрок оглушает врага (через APPLY_STATUS напрямую нельзя, но можно наложить статус перед ходом)
    const stunnedEnemy = getEnemy(sim.getState());
    stunnedEnemy.statusEffects.push({ type: 'stunned', duration: 2, value: 0, statModifiers: null });

    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    // Подготовка сброшена
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
    // Оглушение сбросило подготовку; stunned отображается только в слотах эффектов.
    expect(enemyAfter.statusEffects.some(e => e.type === 'stunned')).toBe(true);
    // Скилл не выполнился — HP игрока не изменилось
    expect(sim.getState().player.hp).toBe(100);
  });

  it('выполняет интенты по старым координатам, если цель ушла', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 3, ap: 3 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedIntent).not.toBeNull();

    // Игрок уходит из зоны поражения
    sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 });
    sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 });
    expect(sim.getState().player.x).toBe(3);

    // Ход AI: выполняет скилл по старым координатам, промахивается
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
    // Урон не нанесён, так как цель ушла
    expect(sim.getState().player.hp).toBe(100);
  });

  it('может совершить дополнительное действие после prepared-скилла, если остался AP', () => {
    // Подготовляем скилл с кулдауном, чтобы после исполнения его нельзя было
    // подготовить повторно — тогда враг пойдёт к игроку.
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['test-fireball', mockAbility('test-fireball', { aiPreparable: true, apCost: 2, cooldown: 3 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });

    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 7,
      y: 5,
      maxAp: 3,
      ap: 3,
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Первый ход: подготовка.
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    const enemyBeforeExecution = getEnemy(sim.getState());
    expect(enemyBeforeExecution.aiState.preparedIntent).not.toBeNull();
    expect(enemyBeforeExecution.x).toBe(7);

    // Второй ход: выполнение prepared-скилла (2 AP) + дополнительный MOVE (1 AP).
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedIntent).toBeNull();
    // Prepared-скилл стоил 2 AP, maxAp=3 — остался 1 AP на MOVE.
    expect(enemyAfter.ap).toBe(0);
    expect(enemyAfter.x).toBe(6);
  });
});
