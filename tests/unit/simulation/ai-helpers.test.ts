import { describe, it, expect } from 'vitest';
import { canSeePlayer, tryAttackOrMoveToward } from '@simulation/ai/ai-helpers';
import { makeGameState, makeEnemy, makePlayer } from '../../fixtures/gameState';
import type { GameMap, EntityId, Entity } from '@simulation/types';

describe('canSeePlayer', () => {
  it('видит игрока в пределах радиуса без препятствий', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 3, aiSightRadius: 3 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(true);
  });

  it('не видит игрока за пределами радиуса', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 1, aiSightRadius: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(false);
  });

  it('не видит игрока через стену', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 1, aiSightRadius: 5 });
    const map: GameMap = {
      width: 10,
      height: 10,
      tiles: Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 10 }, (_, x) => {
          if (x === 0 || x === 9 || y === 0 || y === 9) return 'wall';
          if (y === 3 && x >= 3 && x <= 7) return 'wall';
          return 'floor';
        })
      ),
      rooms: [],
    };
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
      map,
    });

    expect(canSeePlayer(enemy, state)).toBe(false);
  });

  it('видит игрока по диагонали в пределах радиуса', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 3, y: 3, aiSightRadius: 3 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(true);
  });

  it('видит игрока в соседней клетке', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 4, y: 5, aiSightRadius: 1 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(true);
  });

  it('использует евклидов радиус (не видит по углам ромба за пределами круга)', () => {
    const player = makePlayer({ x: 5, y: 5 });
    // (2,5) → расстояние 3 по прямой, но в евклидовом тоже 3
    // Проверим (2,2) → евклидово расстояние sqrt(18) ≈ 4.24
    const enemy = makeEnemy({ x: 2, y: 2, aiSightRadius: 4 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(false);
  });
});

describe('tryAttackOrMoveToward', () => {
  it('атакует, если цель в соседней клетке', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });

    const action = tryAttackOrMoveToward(enemy, state, 6, 5);
    expect(action.type).toBe('ATTACK');
    expect((action as { dx: number }).dx).toBe(1);
    expect((action as { dy: number }).dy).toBe(0);
  });

  it('атакует по диагонали', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });

    const action = tryAttackOrMoveToward(enemy, state, 6, 6);
    expect(action.type).toBe('ATTACK');
    expect((action as { dx: number }).dx).toBe(1);
    expect((action as { dy: number }).dy).toBe(1);
  });

  it('двигается к цели по прямой', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });

    const action = tryAttackOrMoveToward(enemy, state, 8, 5);
    expect(action.type).toBe('MOVE');
    expect((action as { dx: number }).dx).toBe(1);
    expect((action as { dy: number }).dy).toBe(0);
  });

  it('двигается к цели по диагонали', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });

    const action = tryAttackOrMoveToward(enemy, state, 8, 8);
    expect(action.type).toBe('MOVE');
    expect((action as { dx: number }).dx).toBe(1);
    expect((action as { dy: number }).dy).toBe(1);
  });

  it('обходит стену', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const map: GameMap = {
      width: 10,
      height: 10,
      tiles: Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 10 }, (_, x) => {
          if (x === 0 || x === 9 || y === 0 || y === 9) return 'wall';
          if (x === 4 && y >= 2 && y <= 6) return 'wall';
          return 'floor';
        })
      ),
      rooms: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });

    const action = tryAttackOrMoveToward(enemy, state, 6, 2);
    expect(action.type).toBe('MOVE');
    // Должен пойти в обход стены (через (2,1) или (3,1) и т.д.)
    expect((action as { dx: number }).dx === 0 || (action as { dx: number }).dx === 1).toBe(true);
    expect((action as { dy: number }).dy === -1 || (action as { dy: number }).dy === 0).toBe(true);
  });

  it('срезает угол между стенами', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const map: GameMap = {
      width: 10,
      height: 10,
      tiles: Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 10 }, (_, x) => {
          if (x === 0 || x === 9 || y === 0 || y === 9) return 'wall';
          if (x === 3 && y === 2) return 'wall';
          if (x === 2 && y === 3) return 'wall';
          return 'floor';
        })
      ),
      rooms: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });

    const action = tryAttackOrMoveToward(enemy, state, 4, 4);
    // Диагональ в (3,3) разрешена, даже если (3,2) и (2,3) — стены
    expect(action.type).toBe('MOVE');
    expect((action as { dx: number }).dx).toBe(1);
    expect((action as { dy: number }).dy).toBe(1);
  });

  it('возвращает WAIT, если цель недостижима', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const map: GameMap = {
      width: 7,
      height: 7,
      tiles: Array.from({ length: 7 }, (_, y) =>
        Array.from({ length: 7 }, (_, x) => {
          if (x === 0 || x === 6 || y === 0 || y === 6) return 'wall';
          if (x === 2 && y === 2) return 'floor';
          return 'wall';
        })
      ),
      rooms: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });

    const action = tryAttackOrMoveToward(enemy, state, 4, 4);
    expect(action.type).toBe('WAIT');
  });
});
