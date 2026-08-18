import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fillRooms } from '../../../src/simulation/systems/map-generation/shared';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { makeGameState } from '../../fixtures/gameState';
import { createRNG } from '../../../src/utils/rng';
import type { GameMap, Room } from '../../../src/simulation/types';
import type { TileEffects } from '../../../src/simulation/core-types';
import type {
  EntityTemplate,
  ItemTemplate,
  PoiTemplate,
  PropTemplate,
  RoomFill,
  RoomTypeTemplate,
  TerrainTemplate,
  TileEffectTemplate,
  TrapTemplate,
} from '../../../src/content/schemas';

const OUTSIDE_ROOMS = { x: 0, y: 0 };

function makeMapWithRooms(rooms: Room[]): GameMap {
  return {
    width: 20,
    height: 20,
    tiles: Array.from({ length: 20 }, () => Array(20).fill('floor')),
    rooms,
    corridors: [],
  };
}

function makeEmptyTileEffects(): TileEffects[][] {
  return Array.from({ length: 20 }, () => Array(20).fill(null).map(() => ({})));
}

function makeRoomType(id: string, fill: Partial<RoomFill>): RoomTypeTemplate {
  const defaultFill: RoomFill = {
    enemyPool: [],
    enemyDensity: 0,
    itemPool: [],
    itemDensity: 0,
    propPool: [],
    propDensity: 0,
    trapPool: [],
    trapDensity: 0,
    tileEffectPool: [],
    tileEffectDensity: 0,
    guaranteedPois: [],
  };
  return {
    id,
    kind: 'generated',
    weight: 1,
    minDepth: 0,
    minSize: 3,
    maxSize: 8,
    fill: Object.assign({}, defaultFill, fill),
  } as RoomTypeTemplate;
}

describe('fillRooms', () => {
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
      items: new Map<string, ItemTemplate>([
        ['test_item', { id: 'test_item', type: 'consumable' } as ItemTemplate],
      ]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map<string, TileEffectTemplate>([
        ['oil', {
          id: 'oil',
          layer: 'cover',
          duration: 10,
          renderOrder: 1,
        } as TileEffectTemplate],
      ]),
      tileEffectStatuses: new Map(),
      terrains: new Map<string, TerrainTemplate>([
        ['floor', { id: 'floor', walkable: true, tags: ['ground'] } as TerrainTemplate],
      ]),
      props: new Map<string, PropTemplate>([
        ['test_prop', {
          id: 'test_prop',
          maxHp: 3,
          armor: 0,
          blocksMovement: true,
          blocksLOS: false,
          propKind: 'barrel',
          tags: [],
          canHaveStatus: [],
        } as PropTemplate],
      ]),
      traps: new Map<string, TrapTemplate>([
        ['test_trap', {
          id: 'test_trap',
          ruleIds: [],
          oneShot: true,
          initiallyHidden: true,
          tags: [],
        } as TrapTemplate],
      ]),
      pois: new Map<string, PoiTemplate>([
        ['test_poi', {
          id: 'test_poi',
          interactionKind: 'poi',
          ruleIds: [],
          charges: 1,
          chargeSpentOn: 'activation',
          tags: [],
        } as PoiTemplate],
      ]),
      roomTypes: new Map<string, RoomTypeTemplate>([
        ['enemies_only', makeRoomType('enemies_only', { enemyPool: ['cat_small'], enemyDensity: 1 })],
        ['objects', makeRoomType('objects', {
          itemPool: ['test_item'], itemDensity: 1,
          propPool: ['test_prop'], propDensity: 1,
          trapPool: ['test_trap'], trapDensity: 1,
        })],
        ['with_poi', makeRoomType('with_poi', { guaranteedPois: ['test_poi'] })],
        ['puddles', makeRoomType('puddles', { tileEffectPool: ['oil'], tileEffectDensity: 1 })],
        ['crowded', makeRoomType('crowded', {
          enemyPool: ['cat_small'], enemyDensity: 8,
          itemPool: ['test_item'], itemDensity: 8,
          propPool: ['test_prop'], propDensity: 8,
          trapPool: ['test_trap'], trapDensity: 8,
          guaranteedPois: ['test_poi'],
        })],
        ['enemy_and_props', makeRoomType('enemy_and_props', {
          enemyPool: ['cat_small'], enemyDensity: 8,
          propPool: ['test_prop'], propDensity: 8,
        })],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('спавнит ровно 1 врага в комнате 4×4 при density = 1', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 4, height: 4, roomTypeId: 'enemies_only' }]);

    const { enemies } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(enemies.length).toBe(1);
  });

  it('спавнит 4 врагов в комнате 8×8 при density = 1', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8, roomTypeId: 'enemies_only' }]);

    const { enemies } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(enemies.length).toBe(4);
  });

  it('home-координаты врага совпадают с позицией спавна', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8, roomTypeId: 'enemies_only' }]);

    const { enemies } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(enemies.length).toBeGreaterThan(0);
    for (const enemy of enemies) {
      expect(enemy.aiState.homeX).toBe(enemy.x);
      expect(enemy.aiState.homeY).toBe(enemy.y);
    }
  });

  it('не спавнит врагов при density = 0', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8, roomTypeId: 'with_poi' }]);

    const { enemies } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(enemies.length).toBe(0);
  });

  it('пропускает комнаты без roomTypeId', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8 }]);

    const result = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(result.enemies.length).toBe(0);
    expect(result.items.length).toBe(0);
  });

  it('в комнате 4×6 при density = 1 даёт в среднем 1.5 врага', () => {
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 4, height: 6, roomTypeId: 'enemies_only' }]);

    let total = 0;
    const runs = 1000;
    for (let seed = 1; seed <= runs; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const { enemies } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());
      total += enemies.length;
    }

    expect(total / runs).toBeCloseTo(1.5, 1);
  });

  it('размещает предметы, пропы и ловушки по слотам: ловушка не на клетке пропа', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const map = makeMapWithRooms([{ x: 1, y: 1, width: 6, height: 6, roomTypeId: 'objects' }]);

      const { items, props, traps } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

      // 6×6 = 36 клеток → ожидаемое 36/16 = 2.25: минимум по 2 объекта каждого вида.
      expect(props.length).toBeGreaterThanOrEqual(2);
      expect(traps.length).toBeGreaterThanOrEqual(2);
      expect(items.length).toBeGreaterThanOrEqual(2);

      const propCells = new Set(props.map(p => `${p.x},${p.y}`));
      for (const trap of traps) {
        // Слот floorFixture несовместим с solid: ловушка не делит клетку с пропом.
        expect(propCells.has(`${trap.x},${trap.y}`)).toBe(false);
      }
      // Слот solid: пропы не делят клетку с лутом.
      for (const item of items) {
        expect(propCells.has(`${item.x},${item.y}`)).toBe(false);
      }
    }
  });

  it('не размещает объекты на клетке старта игрока', () => {
    const playerStart = { x: 3, y: 3 };
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const map = makeMapWithRooms([{ x: 2, y: 2, width: 4, height: 4, roomTypeId: 'objects' }]);

      const { items, props, traps, pois } = fillRooms(
        state.rng, map, state, playerStart, makeEmptyTileEffects(),
      );

      for (const entity of [...items, ...props, ...traps, ...pois]) {
        expect(entity.x === playerStart.x && entity.y === playerStart.y).toBe(false);
      }
    }
  });

  it('размещает гарантированный poi типа комнаты', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 5, height: 5, roomTypeId: 'with_poi' }]);

    const { pois } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(pois.length).toBe(1);
    expect(pois[0]!.templateId).toBe('test_poi');
  });

  it('размещает лужи тайловых эффектов в сетку на террейне ground', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8, roomTypeId: 'puddles' }]);
    const tileEffects = makeEmptyTileEffects();

    fillRooms(state.rng, map, state, OUTSIDE_ROOMS, tileEffects);

    // 8×8 = 64 клетки → 4 пятна по 1–3 клетки масла.
    const oilCells: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileEffects[y]![x]!['cover']?.type === 'oil') oilCells.push({ x, y });
      }
    }
    expect(oilCells.length).toBeGreaterThanOrEqual(4);
    for (const cell of oilCells) {
      expect(cell.x).toBeGreaterThanOrEqual(2);
      expect(cell.x).toBeLessThanOrEqual(7);
      expect(cell.y).toBeGreaterThanOrEqual(2);
      expect(cell.y).toBeLessThanOrEqual(7);
    }
  });

  it('не ставит лужи при пустом tileEffectPool', () => {
    const state = makeGameState();
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 8, height: 8, roomTypeId: 'enemies_only' }]);
    const tileEffects = makeEmptyTileEffects();

    fillRooms(state.rng, map, state, OUTSIDE_ROOMS, tileEffects);

    const hasAny = tileEffects.some(row => row.some(cell => Object.keys(cell).length > 0));
    expect(hasAny).toBe(false);
  });

  it('не размещает врагов и объекты на зарезервированных клетках (лестница вниз)', () => {
    const stairsDown = { x: 3, y: 3 };
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const map = makeMapWithRooms([{ x: 1, y: 1, width: 6, height: 6, roomTypeId: 'crowded' }]);

      const { enemies, items, props, traps, pois } = fillRooms(
        state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects(), [stairsDown],
      );

      for (const entity of [...enemies, ...items, ...props, ...traps, ...pois]) {
        expect(entity.x === stairsDown.x && entity.y === stairsDown.y).toBe(false);
      }
    }
  });

  it('не спавнит врага на клетке с solid-объектом (гарантированный poi)', () => {
    // Комната 3×3 имеет единственную внутреннюю клетку — её занимает poi,
    // врагу некуда встать, и он не должен появиться вовсе.
    const state = makeGameState({ rng: createRNG(1) });
    const map = makeMapWithRooms([{ x: 1, y: 1, width: 3, height: 3, roomTypeId: 'crowded' }]);

    const { enemies, pois } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

    expect(pois.length).toBe(1);
    expect(enemies.length).toBe(0);
  });

  it('враг не делит клетку с пропом, а при нехватке места лишние враги не спавнятся', () => {
    // Комната 3×3: единственная внутренняя клетка. Плотность требует
    // нескольких врагов и пропов, но место одно — один враг, без пропов.
    for (let seed = 1; seed <= 20; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const map = makeMapWithRooms([{ x: 1, y: 1, width: 3, height: 3, roomTypeId: 'enemy_and_props' }]);

      const { enemies, props } = fillRooms(state.rng, map, state, OUTSIDE_ROOMS, makeEmptyTileEffects());

      expect(enemies.length).toBe(1);
      expect(props.length).toBe(0);
    }
  });
});
