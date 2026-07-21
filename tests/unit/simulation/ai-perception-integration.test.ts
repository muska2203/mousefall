import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../fixtures/gameState';
import type { Entity, EntityId, EnemyEntity, GameMap, GameState } from '@simulation/types';
import type { ExecutionNode, GameEvent } from '@simulation/core-types';
import { createTestSimulation, advanceToPlayerTurn } from '../../helpers/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { initSkillRegistry } from '../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

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

function findAllEvents(result: ReturnType<import('../../../src/simulation/simulation').GameSimulation['dispatch']>, type: GameEvent['type']): ExecutionNode[] {
  const nodes: ExecutionNode[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      nodes.push(...findEvents(action, type));
    }
  }
  return nodes;
}

function createState(overrides: Partial<GameState>): GameState {
  const state = makeGameState(overrides);
  if (overrides.map) {
    const boolGrid = (w: number, h: number, v: boolean) =>
      Array.from({ length: h }, () => Array(w).fill(v) as boolean[]);
    state.visible = boolGrid(state.map.width, state.map.height, false);
    state.explored = boolGrid(state.map.width, state.map.height, false);
  }
  return state;
}

function getEnemy(state: GameState): EnemyEntity {
  for (const entity of state.entities.values()) {
    if (entity.type === 'enemy') return entity as EnemyEntity;
  }
  throw new Error('Враг не найден в состоянии');
}

function makeMapWithDoorway(): GameMap {
  const width = 12;
  const height = 12;
  return {
    width,
    height,
    tiles: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return 'wall';
        // Стена с дверным проёмом в x=5.
        if (y === 4 && x >= 2 && x <= 9 && x !== 5) return 'wall';
        return 'floor';
      })
    ),
    rooms: [],
    corridors: [],
  };
}

describe('AI perception integration', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('враг переходит в chase, когда игрок открывает видимую дверь', () => {
    const map = makeMapWithDoorway();
    // Игрок слева от двери, враг справа и видит дверь.
    const player = makePlayer({ x: 5, y: 3, maxAp: 2, ap: 2 });
    const enemy = makeEnemy({
      id: 'hunter_integration',
      x: 5,
      y: 5,
      aiSightRadius: 5,
    });
    const door = makeDoor({ id: 'door_integration', x: 5, y: 4, isOpen: false, blocksMovement: true });
    const state = createState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
        [door.id, door],
      ]),
      map,
    });

    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'INTERACT', entityId: player.id, targetId: door.id });
    expect(result.success).toBe(true);

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.mode).toBe('chase');
    expect(enemyAfter.aiState.targetX).toBe(5);
    expect(enemyAfter.aiState.targetY).toBe(3);

    // В дереве должно быть событие уведомления AI.
    const notifiedEvents = findAllEvents(result, 'AI_NOTIFIED');
    expect(notifiedEvents.length).toBeGreaterThan(0);
    expect(notifiedEvents[0]!.event).toMatchObject({
      type: 'AI_NOTIFIED',
      entityId: enemy.id,
      change: { kind: 'door_opened', position: { x: 5, y: 4 } },
    });
  });

  it('враг преследует игрока, увиденного при открытии двери, даже если дверь сразу закрылась', () => {
    const map = makeMapWithDoorway();
    // Игрок слева от двери, враг справа и видит дверь.
    const player = makePlayer({ x: 5, y: 3, maxAp: 2, ap: 2 });
    const enemy = makeEnemy({
      id: 'hunter_integration',
      x: 5,
      y: 5,
      aiSightRadius: 5,
      maxAp: 2,
      ap: 2,
    });
    const door = makeDoor({ id: 'door_integration', x: 5, y: 4, isOpen: false, blocksMovement: true });
    const state = createState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
        [door.id, door],
      ]),
      map,
    });

    const sim = createTestSimulation(state);

    // Открываем дверь — в этот момент враг видит игрока.
    const openResult = sim.dispatch({ type: 'INTERACT', entityId: player.id, targetId: door.id });
    expect(openResult.success).toBe(true);

    // Закрываем дверь — тратим оставшиеся AP игрока.
    const closeResult = sim.dispatch({ type: 'INTERACT', entityId: player.id, targetId: door.id });
    expect(closeResult.success).toBe(true);

    // Ход фракции врагов запускается через advanceToPlayerTurn.
    const results = advanceToPlayerTurn(sim);
    const envPhase = results
      .flatMap(r => r.phases)
      .find((p) => p.side === 'enemies' && p.actions.some(a => a.event.type === 'ACTION_APPLIED'));
    expect(envPhase).toBeDefined();

    const enemyAfter = getEnemy(sim.getState());
    expect(enemyAfter.aiState.mode).toBe('chase');
    // Target — последняя видимая позиция игрока, а не дверь.
    expect(enemyAfter.aiState.targetX).toBe(5);
    expect(enemyAfter.aiState.targetY).toBe(3);

    // Враг должен был сделать ход (MOVE или END_TURN если заблокирован).
    const enemyActions = envPhase!.actions.filter(
      (a) => a.event.type === 'ACTION_APPLIED' && a.event.action.entityId === enemy.id,
    );
    expect(enemyActions.length).toBeGreaterThan(0);
  });
});
