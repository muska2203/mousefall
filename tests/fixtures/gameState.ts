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
  FloorItemContainerEntity,
  PlayerEntity,
  DoorEntity,
  StairsEntity,
  TileType
} from '../../src/simulation/types';
import type { MapParams } from '../../src/content/schemas';
import {createRNG} from '../../src/utils/rng';
import { createDefaultAIState } from '../../src/simulation/ai/ai-state';
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
    corridors: [],
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
    factionId: 'player',
    abilities: [],
    activeRules: [],
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
    baseStats: { str: 1, dex: 1, int: 0, vit: 0 },
    statModifiers: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    statusEffects: [],
    blocksMovement: true,
    aiStrategyId: 'hunter',
    aiSightRadius: 6,
    aiState: createDefaultAIState('hunter'),
    maxAp: 1,
    ap: 1,
    isAlive: true,
    factionId: 'enemies',
    abilities: [],
    activeRules: [],
    ...overrides,
  };
}

export function makeFloorItemContainer(
  overrides: Partial<FloorItemContainerEntity> = {},
): FloorItemContainerEntity {
  const instanceId = overrides.item?.instanceId ?? 'floor_item_test_1';
  return {
    id: 'floor_container_test_1',
    type: 'floor_item_container',
    displayName: 'Зелье здоровья',
    x: 4,
    y: 4,
    templateId: 'health_potion',
    blocksMovement: false,
    interactionKind: 'item',
    item: {
      instanceId,
      templateId: 'health_potion',
      quantity: 1,
      grantedAbilities: [],
    },
    ...overrides,
  };
}

export function makeDoor(overrides: Partial<DoorEntity> = {}): DoorEntity {
  return {
    id: 'door_test_1',
    type: 'door',
    displayName: 'Деревянная дверь',
    templateId: 'wooden_door',
    x: 4,
    y: 5,
    blocksMovement: true,
    interactionKind: 'door',
    isOpen: false,
    hp: 30,
    maxHp: 30,
    armor: 2,
    isAlive: true,
    statusEffects: [],
    ...overrides,
  };
}

export function makeStairs(
  templateId: 'stairs_down' | 'stairs_up' | string,
  overrides: Partial<StairsEntity> = {},
): StairsEntity {
  const direction: 'up' | 'down' =
    overrides.direction ?? (templateId === 'stairs_up' ? 'up' : 'down');
  return {
    id: `stairs_${templateId}_${overrides.x ?? 5}_${overrides.y ?? 5}`,
    type: 'stairs',
    displayName: 'Лестница',
    templateId,
    direction,
    blocksMovement: false,
    interactionKind: 'stairs',
    x: 5,
    y: 5,
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
  strategy: 'tree',
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
    turn: {activeSide: 'player', round: 0},
    phase: 'playing',
    floor: 1,
    floorSnapshots: [],
    rng: createRNG(12345),
    nextEntityCounter: 0,
    runStats: {
      startTime: 0,
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
    featureFlags: {
      contentRulesEnabled: false,
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
  const itemEntity = makeFloorItemContainer({ x: 5, y: 5 });
  return makeGameState({
    player: player,
    entities: new Map<EntityId, Entity>([[player.id, player], [itemEntity.id, itemEntity]]),
  });
}
