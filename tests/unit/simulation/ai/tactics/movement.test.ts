import { describe, it, expect } from 'vitest';
import { closeCombat, moveToward, attackTarget } from '@simulation/ai/tactics/movement';
import { makeGameState, makeEnemy, makePlayer, makeDoor } from '../../../../fixtures/gameState';
import type { GameMap, EntityId, Entity, Position } from '@simulation/types';

describe('attackTarget', () => {
  it('возвращает ATTACK в направлении цели', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const target: Position = { x: 6, y: 5 };

    const action = attackTarget(enemy, target);

    expect(action.type).toBe('ATTACK');
    expect(action.dx).toBe(1);
    expect(action.dy).toBe(0);
  });

  it('работает по диагонали', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const target: Position = { x: 6, y: 6 };

    const action = attackTarget(enemy, target);

    expect(action.type).toBe('ATTACK');
    expect(action.dx).toBe(1);
    expect(action.dy).toBe(1);
  });
});

describe('moveToward', () => {
  it('делает шаг к цели по прямой', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });
    const target: Position = { x: 8, y: 5 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(0);
  });

  it('делает шаг к цели по диагонали', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });
    const target: Position = { x: 8, y: 8 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(1);
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
      corridors: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });
    const target: Position = { x: 6, y: 2 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
    expect(result.action.dx === 0 || result.action.dx === 1).toBe(true);
    expect(result.action.dy === -1 || result.action.dy === 0).toBe(true);
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
      corridors: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });
    const target: Position = { x: 4, y: 4 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(1);
  });

  it('возвращает blocked, если цель недостижима', () => {
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
      corridors: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });
    const target: Position = { x: 4, y: 4 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('blocked');
  });

  it('открывает закрытую дверь на пути', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const door = makeDoor({ x: 3, y: 2, isOpen: false, blocksMovement: true });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([
        [enemy.id, enemy],
        [door.id, door],
      ]),
    });
    const target: Position = { x: 5, y: 2 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('interact');
    if (result.kind !== 'interact') return;
    expect(result.action.type).toBe('INTERACT');
    expect(result.action.targetId).toBe(door.id);
  });

  it('проходит через открытую дверь как через обычную клетку', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const door = makeDoor({ x: 3, y: 2, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([
        [enemy.id, enemy],
        [door.id, door],
      ]),
    });
    const target: Position = { x: 5, y: 2 };

    const result = moveToward(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(0);
  });
});

describe('closeCombat', () => {
  it('атакует, если цель в соседней клетке', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });
    const target: Position = { x: 6, y: 5 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('attack');
    if (result.kind !== 'attack') return;
    expect(result.action.type).toBe('ATTACK');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(0);
  });

  it('атакует по диагонали', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });
    const target: Position = { x: 6, y: 6 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('attack');
    if (result.kind !== 'attack') return;
    expect(result.action.type).toBe('ATTACK');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(1);
  });

  it('двигается к цели, если она далеко', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
    });
    const target: Position = { x: 8, y: 5 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
    expect(result.action.dx).toBe(1);
    expect(result.action.dy).toBe(0);
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
      corridors: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });
    const target: Position = { x: 6, y: 2 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('move');
    if (result.kind !== 'move') return;
    expect(result.action.type).toBe('MOVE');
  });

  it('возвращает blocked, если цель недостижима', () => {
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
      corridors: [],
    };
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([[enemy.id, enemy]]),
      map,
    });
    const target: Position = { x: 4, y: 4 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('blocked');
  });

  it('открывает закрытую дверь на пути к цели', () => {
    const enemy = makeEnemy({ x: 2, y: 2 });
    const door = makeDoor({ x: 3, y: 2, isOpen: false, blocksMovement: true });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([
        [enemy.id, enemy],
        [door.id, door],
      ]),
    });
    const target: Position = { x: 5, y: 2 };

    const result = closeCombat(enemy, state, target);

    expect(result.kind).toBe('interact');
    if (result.kind !== 'interact') return;
    expect(result.action.type).toBe('INTERACT');
    expect(result.action.targetId).toBe(door.id);
  });
});
