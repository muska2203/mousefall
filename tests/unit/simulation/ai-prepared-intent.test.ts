import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import type { Entity, EntityId, EnemyEntity } from '../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import type { ExecutionNode, GameEvent } from '../../../src/simulation/core-types';
import { getDerivedAIMode, createDefaultAIState } from '../../../src/simulation/ai/ai-state';
import { registerStrategy } from '../../../src/simulation/ai/strategy-registry';
import { tryPrepareAbility, wait } from '../../../src/simulation/ai/ai-helpers';
import { closeCombat, findVisibleAttackTarget } from '../../../src/simulation/ai/tactics';
import { isEnemyEntity } from '../../../src/simulation/ai/ai-state';
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

/**
 * Тестовая стратегия, имитирующая старое поведение охотника со скиллами.
 *
 * Используется только в этом файле для проверки механики prepared-скиллов
 * независимо от реальной hunter-стратегии, которая сейчас не использует скиллы.
 */
registerStrategy('prepared-test-hunter', {
  updateState() {
    // В тестах FSM не нужен.
  },

  decideAction(actor, state, builder, parent) {
    if (!isEnemyEntity(actor)) return wait(actor);
    const enemy = actor;

    // Приоритет 1: выполнить подготовленную способность.
    if (enemy.aiState.preparedAbility) {
      return {
        type: 'USE_ABILITY',
        entityId: enemy.id,
        abilityId: enemy.aiState.preparedAbility.abilityId,
        targets: enemy.aiState.preparedAbility.targets,
      };
    }

    // Приоритет 2: подготовить способность, если видим цель.
    const visibleTarget = findVisibleAttackTarget(enemy, state);
    if (visibleTarget) {
      if (tryPrepareAbility(enemy, state, builder, parent)) {
        return wait(enemy);
      }

      // Если подготовить не удалось — идём вплотную и атакуем.
      const result = closeCombat(enemy, state, visibleTarget);
      if (result.kind !== 'blocked') {
        return result.action;
      }
    }

    return wait(enemy);
  },
});

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
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
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
    expect(enemyAfterTurn.aiState.preparedAbility).toBeNull();
    expect(getDerivedAIMode(enemyAfterTurn)).not.toBe('prepared');
  });

  it('видит игрока и подготавливает preparable скилл', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
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
    expect(enemyAfterTurn.aiState.preparedAbility).not.toBeNull();
    expect(getDerivedAIMode(enemyAfterTurn)).toBe('prepared');
    expect(enemyAfterTurn.aiState.preparedAbility?.abilityId).toBe('test-fireball');
    expect(enemyAfterTurn.aiState.preparedAbility?.targets).toEqual([{ x: 5, y: 5 }]);

    // Подготовка теперь — side-effect AI-стратегии: событие ABILITY_PREPARED
    // эмитится как child события ACTION_APPLIED (WAIT), а не как отдельный ACTION_APPLIED.
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
      entityId: enemyAfterTurn.id,
      abilityId: 'test-fireball',
      targets: [{ x: 5, y: 5 }],
    });

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
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Первый ход: подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedAbility).not.toBeNull();

    // Второй ход: выполнение
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
    expect(getDerivedAIMode(enemyAfter)).toBe('idle');
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
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedAbility).not.toBeNull();

    // Игрок оглушает врага (через APPLY_STATUS напрямую нельзя, но можно наложить статус перед ходом)
    const stunnedEnemy = getEnemy(sim.getState());
    stunnedEnemy.statusEffects.push({ type: 'stunned', duration: 2, value: 0, statModifiers: null });

    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    // Подготовка сброшена
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
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
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
      abilities: [{ templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Подготовка
    sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(getEnemy(sim.getState()).aiState.preparedAbility).not.toBeNull();

    // Игрок уходит из зоны поражения
    sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 });
    sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 });
    expect(sim.getState().player.x).toBe(3);

    // Ход AI: выполняет скилл по старым координатам, промахивается
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
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
      aiStrategyId: 'prepared-test-hunter',
      aiState: createDefaultAIState('prepared-test-hunter'),
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
    expect(enemyBeforeExecution.aiState.preparedAbility).not.toBeNull();
    expect(enemyBeforeExecution.x).toBe(7);

    // Второй ход: выполнение prepared-скилла (2 AP) + дополнительный MOVE (1 AP).
    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.preparedAbility).toBeNull();
    // Prepared-скилл стоил 2 AP, maxAp=3 — остался 1 AP на MOVE.
    expect(enemyAfter.ap).toBe(0);
    expect(enemyAfter.x).toBe(6);
  });
});
