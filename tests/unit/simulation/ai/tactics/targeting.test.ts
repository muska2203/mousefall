import { describe, it, expect } from 'vitest';
import { findVisibleAttackTarget } from '@simulation/ai/tactics/targeting';
import { makeGameState, makeEnemy, makePlayer } from '../../../../fixtures/gameState';
import type { GameMap, EntityId, Entity } from '@simulation/types';

describe('findVisibleAttackTarget', () => {
  it('возвращает игрока, если он виден', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 3, aiSightRadius: 3 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const target = findVisibleAttackTarget(enemy, state);

    expect(target).not.toBeNull();
    expect(target!.id).toBe(player.id);
    expect(target!.x).toBe(5);
    expect(target!.y).toBe(5);
  });

  it('возвращает null, если игрок вне радиуса видимости', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 1, aiSightRadius: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const target = findVisibleAttackTarget(enemy, state);

    expect(target).toBeNull();
  });

  it('возвращает null, если игрок за стеной', () => {
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
      corridors: [],
    };
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
      map,
    });

    const target = findVisibleAttackTarget(enemy, state);

    expect(target).toBeNull();
  });

  it('возвращает null, если игрок мёртв', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 0, isAlive: false });
    const enemy = makeEnemy({ x: 5, y: 3, aiSightRadius: 3 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const target = findVisibleAttackTarget(enemy, state);

    expect(target).toBeNull();
  });
});
