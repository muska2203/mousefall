import { describe, it, expect } from 'vitest';
import { canSeePlayer } from '@simulation/ai/ai-helpers';
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
      corridors: [],
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
    const enemy = makeEnemy({ x: 2, y: 2, aiSightRadius: 4 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(false);
  });
});
