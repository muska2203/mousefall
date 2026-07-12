import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnEnemiesAndItems } from '../../../src/simulation/systems/map-generation/shared';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { makeGameState } from '../../fixtures/gameState';
import { createRNG } from '../../../src/utils/rng';
import type { MapParams, EntityTemplate } from '../../../src/content/schemas';

function makeSpawnParams(overrides: Partial<MapParams> = {}): MapParams {
  return {
    id: 'test_spawn',
    strategy: 'tree',
    width: 20,
    height: 20,
    minRooms: 2,
    maxRooms: 2,
    minRoomSize: 4,
    maxRoomSize: 4,
    enemyDensity: 1,
    itemDensity: 0,
    enemyPool: ['cat_small'],
    itemPool: [],
    ...overrides,
  };
}

describe('spawnEnemiesAndItems', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map<string, EntityTemplate>([
        ['cat_small', {
          id: 'cat_small',
          maxAp: 1,
          aiStrategyId: 'hunter',
          aiSightRadius: 4,
          health: { max: 10 },
          baseStats: { str: 1, dex: 1, int: 0, vit: 0 },
        } as EntityTemplate],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('спавнит ровно 1 врага в комнате 4×4 при density = 1', () => {
    const state = makeGameState();
    const params = makeSpawnParams();
    const rooms = [{ x: 1, y: 1, width: 4, height: 4 }, { x: 6, y: 1, width: 4, height: 4 }];

    const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);

    expect(enemies.length).toBe(1);
  });

  it('спавнит 4 врагов в комнате 8×8 при density = 1', () => {
    const state = makeGameState();
    const params = makeSpawnParams();
    const rooms = [{ x: 1, y: 1, width: 4, height: 4 }, { x: 6, y: 1, width: 8, height: 8 }];

    const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);

    expect(enemies.length).toBe(4);
  });

  it('home-координаты врага совпадают с позицией спавна', () => {
    const state = makeGameState();
    const params = makeSpawnParams();
    const rooms = [
      { x: 1, y: 1, width: 4, height: 4 },
      { x: 6, y: 1, width: 8, height: 8 },
    ];

    const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);

    expect(enemies.length).toBeGreaterThan(0);
    for (const enemy of enemies) {
      expect(enemy.aiState.homeX).toBe(enemy.x);
      expect(enemy.aiState.homeY).toBe(enemy.y);
    }
  });

  it('не спавнит врагов при density = 0', () => {
    const state = makeGameState();
    const params = makeSpawnParams({ enemyDensity: 0 });
    const rooms = [{ x: 1, y: 1, width: 8, height: 8 }];

    const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);

    expect(enemies.length).toBe(0);
  });

  it('в комнате 4×6 при density = 1 даёт в среднем 1.5 врага', () => {
    const params = makeSpawnParams();
    const rooms = [{ x: 1, y: 1, width: 4, height: 4 }, { x: 6, y: 1, width: 4, height: 6 }];

    let total = 0;
    const runs = 1000;
    for (let seed = 1; seed <= runs; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);
      total += enemies.length;
    }

    const average = total / runs;
    expect(average).toBeCloseTo(1.5, 1);
  });

  it('в комнате 4×6 при density = 1 иногда спавнит 1, а иногда 2 врага', () => {
    const params = makeSpawnParams();
    const rooms = [{ x: 1, y: 1, width: 4, height: 4 }, { x: 6, y: 1, width: 4, height: 6 }];

    let sawOne = false;
    let sawTwo = false;
    for (let seed = 1; seed <= 1000; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const { enemies } = spawnEnemiesAndItems(state.rng, rooms, params, state);
      if (enemies.length === 1) sawOne = true;
      if (enemies.length === 2) sawTwo = true;
      if (sawOne && sawTwo) break;
    }

    expect(sawOne).toBe(true);
    expect(sawTwo).toBe(true);
  });
});
