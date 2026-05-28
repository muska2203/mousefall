/**
 * Система процедурной генерации карт.
 *
 * Генерирует этаж подземелья: комнаты, коридоры, лестницы, размещение врагов/предметов.
 *
 * Алгоритм: простое размещение комнат с соединением коридорами.
 * - Случайно размещать комнаты (без пересечений)
 * - Соединять комнаты L-образными коридорами
 * - Размещать спуск в последней комнате
 * - Спавнить врагов и предметы на основе плотности из MapParams
 *
 * Контракт: generateMap(params, rng) → MapData
 * - НЕ мутирует GameState напрямую
 * - Возвращает полные данные карты; вызывающий применяет их к состоянию
 * - Вся случайность через параметр rng (детерминированно)
 */

import type { GameMap, EnemyEntity, ItemEntity, Room, TileType, GameState, RNGState, StairsEntity } from '../types';
import type { MapParams } from '@content/schemas';
import { rngInt, rngChance } from '../../utils/rng';
import { nextEntityId, createTileGrid } from '../state';
import { getEntity, getItem } from '@content/registry';
import { rollItemAbility } from './item-ability-roll';

// ─────────────────────────────────────────────
// Тип выходных данных
// ─────────────────────────────────────────────

export type GeneratedMap = {
  map: GameMap;
  playerStart: { x: number; y: number };
  stairsDown: { x: number; y: number } | null;
  stairsUp: { x: number; y: number } | null;
  enemies: EnemyEntity[];
  items: ItemEntity[];
};

// ─────────────────────────────────────────────
// Главная точка входа
// ─────────────────────────────────────────────

/**
 * Генерирует полный этаж подземелья.
 * Возвращает данные карты + размещение сущностей.
 * Мутирует `state.nextEntityCounter` для детерминированной генерации ID.
 * Вызывающий применяет возвращённую карту и сущности к состоянию.
 */
export function generateMap(params: MapParams, state: GameState, currentFloor: number, maxFloor: number): GeneratedMap {
  const { width, height } = params;
  const tiles = createTileGrid(width, height);
  const rooms: Room[] = [];
  const rng = state.rng;

  // Place rooms
  const numRooms = rngInt(rng, params.minRooms, params.maxRooms);
  for (let attempt = 0; attempt < numRooms * 3; attempt++) {
    if (rooms.length >= numRooms) break;

    const roomW = rngInt(rng, params.minRoomSize, params.maxRoomSize);
    const roomH = rngInt(rng, params.minRoomSize, params.maxRoomSize);
    const roomX = rngInt(rng, 1, width - roomW - 2);
    const roomY = rngInt(rng, 1, height - roomH - 2);

    const newRoom: Room = { x: roomX, y: roomY, width: roomW, height: roomH };

    if (!overlapsAny(newRoom, rooms)) {
      carveRoom(tiles, newRoom);
      rooms.push(newRoom);
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1]!;
    const curr = rooms[i]!;
    const prevCenter = roomCenter(prev);
    const currCenter = roomCenter(curr);

    // L-образный коридор: сначала горизонтально, затем вертикально (или наоборот)
    if (rngChance(rng, 50)) {
      carveHCorridor(tiles, prevCenter.x, currCenter.x, prevCenter.y);
      carveVCorridor(tiles, prevCenter.y, currCenter.y, currCenter.x);
    } else {
      carveVCorridor(tiles, prevCenter.y, currCenter.y, prevCenter.x);
      carveHCorridor(tiles, prevCenter.x, currCenter.x, currCenter.y);
    }
  }

  // Player starts in first room
  const firstRoom = rooms[0] ?? { x: 1, y: 1, width: 3, height: 3 };
  const playerStart = roomCenter(firstRoom);

  // Place stairs
  let stairsDown: { x: number; y: number } | null = null;
  let stairsUp: { x: number; y: number } | null = null;

  if (rooms.length > 0) {
    const lastRoom = rooms[rooms.length - 1]!;
    stairsDown = roomCenter(lastRoom);
  }

  if (rooms.length > 0 && currentFloor > 1) {
    stairsUp = playerStart;
  }

  // Spawn enemies and items
  const enemies: EnemyEntity[] = [];
  const items: ItemEntity[] = [];

  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i]!;

    // Враги
    if (rngChance(rng, params.enemyDensity * 100)) {
      const templateId = params.enemyPool[rngInt(rng, 0, params.enemyPool.length - 1)] ?? 'cat_small';
      const pos = randomPosInRoom(rng, room);
      enemies.push(createEnemy(state, templateId, pos.x, pos.y));
    }

    // Предметы
    if (rngChance(rng, params.itemDensity * 100)) {
      const templateId = params.itemPool[rngInt(rng, 0, params.itemPool.length - 1)] ?? 'health_potion';
      const pos = randomPosInRoom(rng, room);
      items.push(createFloorItem(state, templateId, pos.x, pos.y));
    }
  }

  return {
    map: { width, height, tiles, rooms },
    playerStart,
    stairsDown,
    stairsUp,
    enemies,
    items,
  };
}

// ─────────────────────────────────────────────
// Вспомогательные функции вырезания карты
// ─────────────────────────────────────────────

function carveRoom(tiles: TileType[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles[y]![x] = 'floor';
    }
  }
}

function carveHCorridor(tiles: TileType[][], x1: number, x2: number, y: number): void {
  const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = minX; x <= maxX; x++) {
    tiles[y]![x] = 'floor';
  }
}

function carveVCorridor(tiles: TileType[][], y1: number, y2: number, x: number): void {
  const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = minY; y <= maxY; y++) {
    tiles[y]![x] = 'floor';
  }
}

function roomCenter(room: Room): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function overlapsAny(room: Room, others: Room[]): boolean {
  return others.some(other =>
    room.x <= other.x + other.width + 1 &&
    room.x + room.width + 1 >= other.x &&
    room.y <= other.y + other.height + 1 &&
    room.y + room.height + 1 >= other.y,
  );
}

function randomPosInRoom(rng: RNGState, room: Room): { x: number; y: number } {
  return {
    x: rngInt(rng, room.x + 1, room.x + room.width - 2),
    y: rngInt(rng, room.y + 1, room.y + room.height - 2),
  };
}

// ─────────────────────────────────────────────
// Вспомогательные функции создания сущностей
// ─────────────────────────────────────────────

function createEnemy(state: GameState, templateId: string, x: number, y: number): EnemyEntity {
  const template = getEntity(templateId);

  return {
    id: nextEntityId(state, 'enemy'),
    type: 'enemy',
    x,
    y,
    displayName: template.name,
    hp: template.health.max,
    maxHp: template.health.max,
    damage: template.combat?.damage ?? 0,
    armor: template.combat?.armor ?? 0,
    templateId,
    statusEffects: [],
    blocksMovement: true,
    maxAp: 1,
    ap: 1,
    isAlive: true,
    aiStrategyId: template.aiStrategyId!, // враги из enemyPool всегда имеют aiStrategyId
    abilities: [],
    activeCast: null,
  };
}

function createFloorItem(state: GameState, templateId: string, x: number, y: number): ItemEntity {
  const template = getItem(templateId);
  return {
    id: nextEntityId(state, 'item'),
    type: 'item',
    x,
    y,
    displayName: template.name,
    templateId,
    quantity: 1,
    grantedAbility: rollItemAbility(template, state.rng),
    blocksMovement: false,
  };
}

export function createStairs(state: GameState, templateId: 'stairs_down' | 'stairs_up', x: number, y: number): StairsEntity {
  return {
    id: nextEntityId(state, 'stairs'),
    type: 'stairs',
    x,
    y,
    displayName: templateId === 'stairs_down' ? 'Лестница вниз' : 'Лестница вверх',
    templateId,
    blocksMovement: false,
  };
}
