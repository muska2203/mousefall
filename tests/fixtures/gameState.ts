/**
 * Тестовые фикстуры для GameState.
 *
 * Предоставляет минимальные валидные объекты GameState для юнит-тестов.
 * Тесты должны использовать эти фикстуры и изменять только нужное.
 *
 * Правила:
 * - Фикстуры — чистые функции (без побочных эффектов)
 * - Фикстуры создают минимально валидное состояние (не реалистичное игровое)
 * - Тесты модифицируют вывод фикстур — никогда не делить мутабельное состояние фикстур между тестами
 */

import type {
  EnemyEntity,
  Entity,
  EntityId,
  GameState,
  ItemEntity,
  PlayerEntity,
  TileType
} from '../../src/simulation/types';
import type { MapParams } from '../../src/content/schemas';
import {createRNG} from '../../src/utils/rng';
import {PLAYER_ID} from '../../src/utils/constants';

// ─────────────────────────────────────────────
// Фикстуры карты
// ─────────────────────────────────────────────

/**
 * Создаёт минимальную карту 10×10 со всеми полами.
 * Окружена стенами по периметру.
 */
export function makeTestMap(width = 10, height = 10) {
  const tiles: TileType[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return 'wall';
      return 'floor';
    }),
  );

  return {
    width,
    height,
    tiles,
    rooms: [{ x: 1, y: 1, width: width - 2, height: height - 2 }],
  };
}

// ─────────────────────────────────────────────
// Фикстуры сущностей
// ─────────────────────────────────────────────

export function makePlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: PLAYER_ID,
    type: 'player',
    displayName: 'Герой',
    templateId: 'witcher',
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    damage: 10,
    armor: 0,
    xp: 0,
    level: 1,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    equippedWeaponInstanceId: null,
    equippedArmorInstanceId: null,
    equippedAmuletInstanceId: null,
    mp: 0,
    maxMp: 0,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    statusEffects: [],
    blocksMovement: true,
    maxAp: 1,
    ap: 1,
    isAlive: true,
    abilities: [],
    ...overrides,
  };
}

export function makeEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 'enemy_test_1',
    type: 'enemy',
    displayName: 'Тестовый враг',
    x: 3,
    y: 3,
    hp: 20,
    maxHp: 20,
    damage: 5,
    armor: 0,
    templateId: 'cat_small',
    statusEffects: [],
    blocksMovement: true,
    aiStrategyId: 'stub_right',
    maxAp: 1,
    ap: 1,
    isAlive: true,
    abilities: [],
    ...overrides,
  };
}

export function makeFloorItem(overrides: Partial<ItemEntity> = {}): ItemEntity {
  return {
    id: 'item_test_1',
    type: 'item',
    displayName: 'Зелье здоровья',
    x: 4,
    y: 4,
    templateId: 'health_potion',
    quantity: 1,
    grantedAbility: null,
    blocksMovement: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Фикстура полного GameState
// ─────────────────────────────────────────────

/**
 * Создаёт минимально валидный GameState для тестирования.
 * Игрок в (5,5), без врагов, без предметов, карта 10×10.
 */
export const defaultTestMapParams: MapParams = {
  id: 'test',
  width: 10,
  height: 10,
  minRooms: 2,
  maxRooms: 4,
  minRoomSize: 3,
  maxRoomSize: 5,
  enemyDensity: 0,
  itemDensity: 0,
  enemyPool: [],
  itemPool: [],
};

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const map = makeTestMap();
  const boolGrid = (w: number, h: number, v: boolean) =>
    Array.from({ length: h }, () => Array(w).fill(v) as boolean[]);

  const player = makePlayer();
  return {
    map,
    mapParams: defaultTestMapParams,
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player]]),
    visible: boolGrid(map.width, map.height, false),
    explored: boolGrid(map.width, map.height, false),
    turn: {activeSide: 'PLAYER', round: 0},
    phase: 'playing',
    floor: 1,
    floorSnapshots: [],
    rng: createRNG(12345),
    nextEntityCounter: 0,
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
    ...overrides,
  };
}

/**
 * Создаёт GameState с одним врагом рядом с игроком.
 * Игрок в (5,5), враг в (6,5) — на один шаг вправо.
 */
export function makeStateWithEnemy(): GameState {
  const player = makePlayer({ x: 5, y: 5 });
  const entity = makeEnemy({ x: 6, y: 5 });
  return makeGameState({
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player], [entity.id, entity]]),
  });
}

export function makeStateWithPlayer(player: PlayerEntity): GameState {
  return makeGameState({
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player]]),
  });
}

export function makeStateWithPlayerAndEntity(player: PlayerEntity, entity: Entity): GameState {
  return makeGameState({
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player], [entity.id, entity]]),
  });
}

export function makeStateWithEntity(entity: Entity): GameState {
  return makeGameState({
    entities: new Map<EntityId, Entity>([[entity.id, entity]]),
  });
}

/**
 * Создаёт GameState с предметом на полу в позиции игрока.
 */
export function makeStateWithItem(): GameState {
  const player = makePlayer({ x: 5, y: 5 });
  const itemEntity = makeFloorItem({ x: 5, y: 5 });
  return makeGameState({
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player], [itemEntity.id, itemEntity]]),
  });
}
