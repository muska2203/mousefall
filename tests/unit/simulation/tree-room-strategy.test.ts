import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { treeRoomStrategy } from '../../../src/simulation/systems/map-generation/tree-room-strategy';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { makeGameState } from '../../fixtures/gameState';
import { createRNG } from '../../../src/utils/rng';
import type { DoorTemplate, MapParams, PoiTemplate } from '../../../src/content/schemas';

function makeParams(overrides: Partial<MapParams> = {}): MapParams {
  return {
    id: 'test_tree',
    strategy: 'tree',
    width: 20,
    height: 20,
    minRooms: 3,
    maxRooms: 5,
    minRoomSize: 3,
    maxRoomSize: 6,
    enemyDensity: 0,
    itemDensity: 0,
    enemyPool: [],
    itemPool: [],
    ...overrides,
  };
}

describe('treeRoomStrategy: спавн poi стартовой комнаты', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map<string, DoorTemplate>([
        ['wooden_door', { id: 'wooden_door', maxHp: 30, armor: 2 } as DoorTemplate],
      ]),
      stairs: new Map(),
      pois: new Map<string, PoiTemplate>([
        ['test_poi', {
          id: 'test_poi',
          interactionKind: 'poi',
          ruleIds: [],
          charges: 1,
          chargeSpentOn: 'activation',
          renderScale: 1,
          tags: [],
        } as PoiTemplate],
      ]),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('размещает startPoiId рядом со спавном в корневой комнате', () => {
    const state = makeGameState({ rng: createRNG(42) });
    const result = treeRoomStrategy.generate(makeParams({ startPoiId: 'test_poi' }), state, 1, 5);

    expect(result.pois.length).toBe(1);
    const poi = result.pois[0]!;
    expect(poi.templateId).toBe('test_poi');

    // 8-соседство со спавном (сама клетка спавна исключена).
    const dx = Math.abs(poi.x - result.playerStart.x);
    const dy = Math.abs(poi.y - result.playerStart.y);
    expect(dx).toBeLessThanOrEqual(1);
    expect(dy).toBeLessThanOrEqual(1);
    expect(dx + dy).toBeGreaterThan(0);

    // Внутри корневой комнаты (rooms[0] — корень дерева).
    const root = result.map.rooms[0]!;
    expect(poi.x).toBeGreaterThanOrEqual(root.x);
    expect(poi.x).toBeLessThan(root.x + root.width);
    expect(poi.y).toBeGreaterThanOrEqual(root.y);
    expect(poi.y).toBeLessThan(root.y + root.height);
  });

  it('не перекрывает двери и клетку спавна (лестница вверх на этажах > 1)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ startPoiId: 'test_poi' }), state, 2, 5);

      if (result.pois.length === 0) continue;
      const poi = result.pois[0]!;
      // stairsUp ставится потребителем на playerStart — poi не должен занимать эту клетку.
      expect(poi.x === result.playerStart.x && poi.y === result.playerStart.y).toBe(false);
      for (const door of result.doors) {
        expect(door.x === poi.x && door.y === poi.y).toBe(false);
      }
    }
  });

  it('не размещает poi без startPoiId', () => {
    const state = makeGameState({ rng: createRNG(42) });
    const result = treeRoomStrategy.generate(makeParams(), state, 1, 5);

    expect(result.pois.length).toBe(0);
  });

  it('детерминирован по seed', () => {
    const params = makeParams({ startPoiId: 'test_poi' });
    const first = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);
    const second = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);

    expect(first.pois.length).toBe(1);
    expect(second.pois.length).toBe(1);
    expect({ x: first.pois[0]!.x, y: first.pois[0]!.y }).toEqual({ x: second.pois[0]!.x, y: second.pois[0]!.y });
  });
});
