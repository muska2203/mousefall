import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateMap } from '@simulation/systems/mapgen';
import { initRegistry, resetRegistry } from '@content/registry';
import type { MapParams, DoorTemplate } from '@content/schemas';
import type { Room } from '@simulation/types';
import { makeGameState } from '../../fixtures/gameState';

function makeTreeParams(overrides: Partial<MapParams> = {}): MapParams {
  return {
    id: 'test_tree',
    strategy: 'tree',
    width: 40,
    height: 40,
    minRooms: 5,
    maxRooms: 10,
    minRoomSize: 3,
    maxRoomSize: 6,
    enemyDensity: 0,
    itemDensity: 0,
    enemyPool: [],
    itemPool: [],
    ...overrides,
  };
}

function getRoomCells(room: Room): Set<string> {
  const set = new Set<string>();
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      set.add(`${x},${y}`);
    }
  }
  return set;
}

function parseKey(key: string): { x: number; y: number } {
  const parts = key.split(',');
  return { x: Number(parts[0]), y: Number(parts[1]) };
}

function hasNearbyDoor(key: string, doorPositions: Set<string>): boolean {
  const { x, y } = parseKey(key);
  for (const other of doorPositions) {
    const { x: ox, y: oy } = parseKey(other);
    if (Math.abs(x - ox) <= 1 && Math.abs(y - oy) <= 1) return true;
  }
  return false;
}

function roomsOverlap(a: Room, b: Room): boolean {
  return (
    a.x <= b.x + b.width + 1 &&
    a.x + a.width + 1 >= b.x &&
    a.y <= b.y + b.height + 1 &&
    a.y + a.height + 1 >= b.y
  );
}

function roomsIntersect(a: Room, b: Room): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getAdjacentRoomIndices(rooms: Room[], x: number, y: number): number[] {
  const indices: number[] = [];
  rooms.forEach((room, index) => {
    const onHorizontalWall =
      x >= room.x && x < room.x + room.width && (y === room.y - 1 || y === room.y + room.height);
    const onVerticalWall =
      y >= room.y && y < room.y + room.height && (x === room.x - 1 || x === room.x + room.width);
    if (onHorizontalWall || onVerticalWall) indices.push(index);
  });
  return indices;
}

function pairKey(i: number, j: number): string {
  return i < j ? `${i},${j}` : `${j},${i}`;
}

describe('treeRoomStrategy', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate],
      ]),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('генерирует карту с минимальным числом комнат, спавном и лестницей', () => {
    const state = makeGameState();
    const params = makeTreeParams();
    const result = generateMap(params, state, 1, 3);

    expect(result.map.rooms.length).toBeGreaterThanOrEqual(params.minRooms);
    expect(result.playerStart.x).toBeGreaterThanOrEqual(1);
    expect(result.playerStart.x).toBeLessThan(result.map.width - 1);
    expect(result.playerStart.y).toBeGreaterThanOrEqual(1);
    expect(result.playerStart.y).toBeLessThan(result.map.height - 1);
    expect(result.stairsDown).not.toBeNull();

    const startTile = result.map.tiles[result.playerStart.y]![result.playerStart.x];
    expect(startTile).toBe('floor');

    if (result.stairsDown) {
      const stairsTile = result.map.tiles[result.stairsDown.y]![result.stairsDown.x];
      expect(stairsTile).toBe('floor');
    }
  });

  it('размещает все комнаты внутри границ карты без пересечений', () => {
    const state = makeGameState();
    const params = makeTreeParams();
    const result = generateMap(params, state, 1, 3);

    for (const room of result.map.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(1);
      expect(room.y).toBeGreaterThanOrEqual(1);
      expect(room.x + room.width).toBeLessThan(result.map.width);
      expect(room.y + room.height).toBeLessThan(result.map.height);
      expect(room.width).toBeGreaterThanOrEqual(params.minRoomSize);
      expect(room.height).toBeGreaterThanOrEqual(params.minRoomSize);

      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          expect(result.map.tiles[y]![x]).toBe('floor');
        }
      }
    }

    // Соединённые коридором комнаты могут быть на расстоянии 1 тайл,
    // остальные комнаты должны иметь отступ минимум 1 тайл друг от друга.
    const connectedPairs = new Set<string>();
    for (let ci = 0; ci < result.map.corridors.length; ci++) {
      const corridor = result.map.corridors[ci]!;
      const start = corridor.segments[0]!;
      const end = corridor.segments[corridor.segments.length - 1]!;
      const startAdjacent = getAdjacentRoomIndices(result.map.rooms, start.x1, start.y1);
      const endAdjacent = getAdjacentRoomIndices(result.map.rooms, end.x2, end.y2);
      const adjacent = new Set<number>([...startAdjacent, ...endAdjacent]);
      const indices = Array.from(adjacent);
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          connectedPairs.add(pairKey(indices[i]!, indices[j]!));
        }
      }
    }

    for (let i = 0; i < result.map.rooms.length; i++) {
      for (let j = i + 1; j < result.map.rooms.length; j++) {
        const a = result.map.rooms[i]!;
        const b = result.map.rooms[j]!;
        const isConnected = connectedPairs.has(pairKey(i, j));
        if (isConnected) {
          expect(roomsIntersect(a, b)).toBe(false);
        } else {
          expect(roomsOverlap(a, b)).toBe(false);
        }
      }
    }
  });

  it('коридоры не пересекают комнаты и все их клетки являются полом', () => {
    const state = makeGameState();
    const params = makeTreeParams();
    const result = generateMap(params, state, 1, 3);

    const roomCells = new Set<string>();
    for (const room of result.map.rooms) {
      for (const key of getRoomCells(room)) roomCells.add(key);
    }

    for (const corridor of result.map.corridors) {
      for (const segment of corridor.segments) {
        // Сегменты коридора в tree-стратегии всегда осевые (горизонтальные или вертикальные).
        const minX = Math.min(segment.x1, segment.x2);
        const maxX = Math.max(segment.x1, segment.x2);
        const minY = Math.min(segment.y1, segment.y2);
        const maxY = Math.max(segment.y1, segment.y2);

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            expect(result.map.tiles[y]![x]).toBe('floor');
            expect(roomCells.has(`${x},${y}`)).toBe(false);
          }
        }
      }
    }
  });

  it('может расширять карту за пределы mapParams.width/height', () => {
    const state = makeGameState();
    const params = makeTreeParams({ width: 20, height: 20, maxRooms: 15 });
    const result = generateMap(params, state, 1, 3);

    expect(result.map.width).toBeGreaterThanOrEqual(params.width);
    expect(result.map.height).toBeGreaterThanOrEqual(params.height);
  });

  it('ставит закрытые двери на обоих концах коридора', () => {
    const state = makeGameState();
    const params = makeTreeParams();
    const result = generateMap(params, state, 1, 3);

    expect(result.doors.length).toBeGreaterThan(0);

    const doorPositions = new Set<string>(result.doors.map(d => `${d.x},${d.y}`));

    for (const door of result.doors) {
      expect(door.type).toBe('door');
      expect(door.isOpen).toBe(false);
      expect(door.x).toBeGreaterThanOrEqual(1);
      expect(door.x).toBeLessThan(result.map.width - 1);
      expect(door.y).toBeGreaterThanOrEqual(1);
      expect(door.y).toBeLessThan(result.map.height - 1);
      expect(result.map.tiles[door.y]![door.x]).toBe('floor');
    }

    // Двери не должны находиться ближе 1 клетки друг к другу.
    for (let i = 0; i < result.doors.length; i++) {
      for (let j = i + 1; j < result.doors.length; j++) {
        const a = result.doors[i]!;
        const b = result.doors[j]!;
        const distance = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        expect(distance).toBeGreaterThanOrEqual(2);
      }
    }

    // Коридор может иметь длину либо 1 тайл, либо 3 и более.
    // Длина 2 тайла запрещена, так как в неё не влезают две двери.
    for (const corridor of result.map.corridors) {
      const length =
        1 +
        corridor.segments.reduce(
          (sum, seg) => sum + Math.max(Math.abs(seg.x2 - seg.x1), Math.abs(seg.y2 - seg.y1)),
          0,
        );
      expect(length).not.toBe(2);

      const start = corridor.segments[0]!;
      const end = corridor.segments[corridor.segments.length - 1]!;
      const startKey = `${start.x1},${start.y1}`;
      const endKey = `${end.x2},${end.y2}`;

      if (length === 1) {
        expect(doorPositions.has(startKey)).toBe(true);
      } else {
        // Для коридоров длины ≥3 проверяем, что двери стоят на концах,
        // либо что конец был пропущен из-за соседней двери.
        expect(doorPositions.has(startKey) || hasNearbyDoor(startKey, doorPositions)).toBe(true);
        expect(doorPositions.has(endKey) || hasNearbyDoor(endKey, doorPositions)).toBe(true);
      }
    }
  });

  it('детерминированно генерирует одинаковую карту на одном сиде', () => {
    const state1 = makeGameState({ rng: { seed: 42, state: 42 >>> 0 } });
    const state2 = makeGameState({ rng: { seed: 42, state: 42 >>> 0 } });
    const params = makeTreeParams();

    const result1 = generateMap(params, state1, 1, 3);
    const result2 = generateMap(params, state2, 1, 3);

    expect(result1.map.width).toBe(result2.map.width);
    expect(result1.map.height).toBe(result2.map.height);
    expect(result1.map.rooms.length).toBe(result2.map.rooms.length);
    expect(result1.playerStart).toEqual(result2.playerStart);
    expect(result1.stairsDown).toEqual(result2.stairsDown);
    expect(result1.enemies.length).toBe(result2.enemies.length);
    expect(result1.items.length).toBe(result2.items.length);
  });

  it('коридоры не идут впритык к комнатам, кроме концов коридора', () => {
    // Проверяем на нескольких сидах, чтобы поймать редкие случаи.
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: { seed, state: seed >>> 0 } });
      const params = makeTreeParams();
      const result = generateMap(params, state, 1, 3);

      const roomCellSets = result.map.rooms.map(room => getRoomCells(room));

      for (const corridor of result.map.corridors) {
        const cells = new Set<string>();
        const endpoints = new Set<string>();
        for (let i = 0; i < corridor.segments.length; i++) {
          const segment = corridor.segments[i]!;
          const minX = Math.min(segment.x1, segment.x2);
          const maxX = Math.max(segment.x1, segment.x2);
          const minY = Math.min(segment.y1, segment.y2);
          const maxY = Math.max(segment.y1, segment.y2);
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const key = `${x},${y}`;
              cells.add(key);
              if (i === 0 && x === segment.x1 && y === segment.y1) endpoints.add(key);
              if (i === corridor.segments.length - 1 && x === segment.x2 && y === segment.y2)
                endpoints.add(key);
            }
          }
        }

        for (const key of cells) {
          if (endpoints.has(key)) continue;
          const { x, y } = parseKey(key);
          for (const [dx, dy] of [
            [0, 1] as const,
            [0, -1] as const,
            [1, 0] as const,
            [-1, 0] as const,
          ]) {
            const neighborKey = `${x + dx},${y + dy}`;
            for (const roomCells of roomCellSets) {
              expect(
                roomCells.has(neighborKey),
                `seed ${seed}: corridor cell ${key} is adjacent to room cell ${neighborKey}`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });
});
