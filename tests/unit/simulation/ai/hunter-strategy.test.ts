import { describe, it, expect } from 'vitest';
import '@simulation/ai/hunter-strategy';
import { getStrategy } from '@simulation/ai/strategy-registry';
import type { WorldChange } from '@simulation/ai/perception-types';
import { makeGameState, makeEnemy, makePlayer, makeDoor } from '../../../fixtures/gameState';
import type { EnemyEntity, Entity, EntityId, GameMap, GameState } from '@simulation/types';
import type { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';

function createStateWithEnemyAndMap(
  player: { x: number; y: number },
  enemy: { x: number; y: number; aiSightRadius: number },
  map?: GameMap,
): { state: GameState; enemy: EnemyEntity } {
  const playerEntity = makePlayer({ x: player.x, y: player.y });
  const enemyEntity = makeEnemy({
    id: 'hunter_test',
    x: enemy.x,
    y: enemy.y,
    aiSightRadius: enemy.aiSightRadius,
  });
  const overrides: Partial<GameState> = {
    player: playerEntity,
    entities: new Map<EntityId, Entity>([
      [playerEntity.id, playerEntity],
      [enemyEntity.id, enemyEntity],
    ]),
  };
  if (map) {
    overrides.map = map;
  }
  const state = makeGameState(overrides);
  return { state, enemy: enemyEntity };
}

function makeMapWithHorizontalWall(): GameMap {
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

describe('hunter strategy decideAction', () => {
  it('двигается на lastSeen-клетку в режиме chase, а не атакует пустой тайл рядом с ней', () => {
    const playerEntity = makePlayer({ x: 8, y: 8 });
    const enemyEntity = makeEnemy({
      id: 'hunter_test',
      x: 6,
      y: 5,
      aiSightRadius: 3,
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: 5,
        targetY: 5,
        homeX: 6,
        homeY: 3,
        preparedAbility: null,
      },
    });
    const state = makeGameState({
      player: playerEntity,
      entities: new Map<EntityId, Entity>([
        [playerEntity.id, playerEntity],
        [enemyEntity.id, enemyEntity],
      ]),
    });

    const action = getStrategy('hunter').decideAction(enemyEntity, state, null as unknown as ExecutionBuilder, null as unknown as ExecutionNode);

    expect(action.type).toBe('MOVE');
    expect(action).toMatchObject({ dx: -1, dy: 0 });
  });

  it('после достижения lastSeen уходит в return к точке спавна', () => {
    const playerEntity = makePlayer({ x: 8, y: 8 });
    const enemyEntity = makeEnemy({
      id: 'hunter_test',
      x: 5,
      y: 5,
      aiSightRadius: 3,
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: 5,
        targetY: 5,
        homeX: 5,
        homeY: 3,
        preparedAbility: null,
      },
    });
    const state = makeGameState({
      player: playerEntity,
      entities: new Map<EntityId, Entity>([
        [playerEntity.id, playerEntity],
        [enemyEntity.id, enemyEntity],
      ]),
    });

    getStrategy('hunter').updateState?.(enemyEntity, state);

    expect(enemyEntity.aiState.mode).toBe('return');
    expect(enemyEntity.aiState.targetX).toBeNull();
    expect(enemyEntity.aiState.targetY).toBeNull();

    const action = getStrategy('hunter').decideAction(enemyEntity, state, null as unknown as ExecutionBuilder, null as unknown as ExecutionNode);

    expect(action.type).toBe('MOVE');
    expect(action).toMatchObject({ dx: 0, dy: -1 });
  });
});

describe('hunter strategy onWorldChange', () => {
  it('переходит в chase на игрока при видимом движении', () => {
    const { state, enemy } = createStateWithEnemyAndMap(
      { x: 5, y: 5 },
      { x: 5, y: 3, aiSightRadius: 3 },
    );

    const change: WorldChange = {
      kind: 'entity_moved',
      entityId: 'player',
      from: { x: 5, y: 4 },
      to: { x: 5, y: 5 },
    };

    getStrategy('hunter').onWorldChange?.(enemy, state, change);

    expect(enemy.aiState.mode).toBe('chase');
    expect(enemy.aiState.targetX).toBe(5);
    expect(enemy.aiState.targetY).toBe(5);
  });

  it('игнорирует движение игрока за стеной', () => {
    const map = makeMapWithHorizontalWall();
    // Игрок слева от дверного проёма — стена блокирует LOS.
    const { state, enemy } = createStateWithEnemyAndMap(
      { x: 2, y: 5 },
      { x: 5, y: 2, aiSightRadius: 5 },
      map,
    );

    const change: WorldChange = {
      kind: 'entity_moved',
      entityId: 'player',
      from: { x: 2, y: 4 },
      to: { x: 2, y: 5 },
    };

    getStrategy('hunter').onWorldChange?.(enemy, state, change);

    expect(enemy.aiState.mode).toBe('idle');
    expect(enemy.aiState.targetX).toBeNull();
    expect(enemy.aiState.targetY).toBeNull();
  });

  it('переходит в chase на игрока, если он стал виден за открытой дверью', () => {
    const map = makeMapWithHorizontalWall();
    const playerEntity = makePlayer({ x: 5, y: 5 });
    const enemyEntity = makeEnemy({
      id: 'hunter_test',
      x: 5,
      y: 2,
      aiSightRadius: 5,
    });
    const door = makeDoor({ x: 5, y: 4, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player: playerEntity,
      entities: new Map<EntityId, Entity>([
        [playerEntity.id, playerEntity],
        [enemyEntity.id, enemyEntity],
        [door.id, door],
      ]),
      map,
    });

    const change: WorldChange = {
      kind: 'door_opened',
      position: { x: 5, y: 4 },
    };

    getStrategy('hunter').onWorldChange?.(enemyEntity, state, change);

    expect(enemyEntity.aiState.mode).toBe('chase');
    expect(enemyEntity.aiState.targetX).toBe(5);
    expect(enemyEntity.aiState.targetY).toBe(5);
  });

  it('не реагирует на открытие двери, если игрок за ней не стал виден', () => {
    const map = makeMapWithHorizontalWall();
    // Игрок далеко за стеной — вне радиуса врага даже с открытой дверью.
    const playerEntity = makePlayer({ x: 5, y: 9 });
    const enemyEntity = makeEnemy({
      id: 'hunter_test',
      x: 5,
      y: 2,
      aiSightRadius: 5,
    });
    const door = makeDoor({ x: 5, y: 4, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player: playerEntity,
      entities: new Map<EntityId, Entity>([
        [playerEntity.id, playerEntity],
        [enemyEntity.id, enemyEntity],
        [door.id, door],
      ]),
      map,
    });

    const change: WorldChange = {
      kind: 'door_opened',
      position: { x: 5, y: 4 },
    };

    getStrategy('hunter').onWorldChange?.(enemyEntity, state, change);

    expect(enemyEntity.aiState.mode).toBe('idle');
    expect(enemyEntity.aiState.targetX).toBeNull();
    expect(enemyEntity.aiState.targetY).toBeNull();
  });

  it('переходит в chase на игрока при закрытии двери, если игрок всё ещё виден', () => {
    const { state, enemy } = createStateWithEnemyAndMap(
      { x: 5, y: 5 },
      { x: 5, y: 3, aiSightRadius: 3 },
    );

    const change: WorldChange = {
      kind: 'door_closed',
      position: { x: 5, y: 4 },
    };

    getStrategy('hunter').onWorldChange?.(enemy, state, change);

    expect(enemy.aiState.mode).toBe('chase');
    expect(enemy.aiState.targetX).toBe(5);
    expect(enemy.aiState.targetY).toBe(5);
  });

  it('игнорирует движение другого врага', () => {
    const { state, enemy } = createStateWithEnemyAndMap(
      { x: 5, y: 5 },
      { x: 5, y: 3, aiSightRadius: 3 },
    );

    const change: WorldChange = {
      kind: 'entity_moved',
      entityId: 'other_enemy',
      from: { x: 5, y: 4 },
      to: { x: 5, y: 5 },
    };

    getStrategy('hunter').onWorldChange?.(enemy, state, change);

    expect(enemy.aiState.mode).toBe('idle');
    expect(enemy.aiState.targetX).toBeNull();
    expect(enemy.aiState.targetY).toBeNull();
  });
});
