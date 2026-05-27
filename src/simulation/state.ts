/**
 * Фабрика игрового состояния и вспомогательные функции.
 *
 * Ответственность:
 * - Создание начального GameState для новой игры
 * - Создание начального GameState для нового этажа
 * - Вспомогательные функции для запросов к состоянию
 *
 * Правила:
 * - Здесь нет игровой логики (она в systems/)
 * - Никакой случайности, кроме createRNG()
 * - Все хелперы — чистые функции (только чтение, без мутаций)
 */

import type {
  Actor,
  AiActor,
  Attackable,
  Attacker,
  Entity,
  EntityId,
  EntityType,
  GameState,
  PlayerEntity,
  EnemyEntity,
  Position,
  TileType,
} from './types';
import type { MapParams } from '@content/schemas';
import {createRNG} from '../utils/rng';
import {PLAYER_ID} from '../utils/constants';

// ─────────────────────────────────────────────
// Фабрика начального состояния
// ─────────────────────────────────────────────

/**
 * Создаёт начальное игровое состояние для новой игры.
 * Генерация карты здесь НЕ выполняется — вызовите generateMap() отдельно
 * и передайте результат в createStateForFloor().
 */
export function createInitialPlayer(templateId: string): PlayerEntity {
  return {
    id: PLAYER_ID,
    type: 'player',
    blocksMovement: true,
    displayName: 'Герой',
    templateId,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    damage: 8,
    armor: 0,
    statusEffects: [],
    xp: 0,
    level: 1,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    isAlive: true,
    ap: 1,
    maxAp: 1,
    mp: 0,
    maxMp: 0,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    abilities: [],
  };
}

/**
 * Создаёт пустую двумерную булеву сетку (для массивов visible/explored).
 */
export function createBoolGrid(width: number, height: number, value: boolean): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(value));
}

/**
 * Создаёт пустую двумерную сетку тайлов, заполненную стенами.
 */
export function createTileGrid(width: number, height: number): TileType[][] {
  return Array.from({ length: height }, () => Array<TileType>(width).fill('wall'));
}

/**
 * Создаёт минимально валидный GameState.
 * Используется как база перед тем, как генерация карты заполнит карту и позиции сущностей.
 */
export function createNewGameState(seed: number, mapParams: MapParams, playerTemplateId: string): GameState {
  const mapWidth = mapParams.width;
  const mapHeight = mapParams.height;
  const player = createInitialPlayer(playerTemplateId);

  return {
    map: {
      width: mapWidth,
      height: mapHeight,
      tiles: createTileGrid(mapWidth, mapHeight),
      rooms: [],
    },
    mapParams,
    entities: new Map<EntityId, Entity>([[player.id, player]]),
    player: player,
    visible: createBoolGrid(mapWidth, mapHeight, false),
    explored: createBoolGrid(mapWidth, mapHeight, false),
    turn: {round: 1, activeSide: 'PLAYER'},
    phase: 'playing',
    floor: 1,
    floorSnapshots: [],
    rng: createRNG(seed),
    nextEntityCounter: 0,
  };
}

// ─────────────────────────────────────────────
// Хелперы запросов к состоянию (чистые, только чтение)
// ─────────────────────────────────────────────



export function findEntity(state: GameState, id: EntityId) {
  return state.entities.get(id);
}

export function isActor(entity: unknown): entity is Actor {
  return typeof entity === 'object' && entity !== null && 'ap' in entity && 'maxAp' in entity;
}

export function findAttackableEntity(state: GameState, id: EntityId): (Entity & Attackable) | undefined {
  const foundEntity = state.entities.get(id);
  if (foundEntity && 'hp' in foundEntity && foundEntity.isAlive !== false) {
    return foundEntity as Entity & Attackable;
  }
  return undefined;
}

/**
 * Физически удаляет всех мёртвых сущностей из state.entities.
 * Вызывается в конце хода окружения, перед началом хода игрока.
 */
export function cleanupDeadEntities(state: GameState): void {
  for (const [id, entity] of state.entities) {
    if (id === PLAYER_ID) continue;
    if ('isAlive' in entity && entity.isAlive === false) {
      state.entities.delete(id);
    }
  }
}


export function findAttacker(state: GameState, id: EntityId): (Entity & Attacker) | undefined {
  const foundEntity = state.entities.get(id);
  if (foundEntity && 'damage' in foundEntity) {
    return foundEntity as Entity & Attacker;
  }
  return undefined;
}

export function findAllAliveAiActors(state: GameState) {
  return Array.from(state.entities.values())
      .filter(e => 'aiStrategyId' in e)
      .map(e => e as AiActor)
      .filter(e => e.isAlive);
}

export const TARGET_PRIORITY: Record<EntityType, number> = {
  player: 100,
  enemy: 90,
  item: 0,
  stairs: 0,
};

export function findFirstAttackableEntityAt(state: GameState, x: number, y: number): (Entity & Attackable) | undefined {
  return findAllEntitiesAt(state, x, y)
      .filter(e => 'hp' in e && (e as Entity & Attackable).isAlive !== false)
      .map(e => e as Entity & Attackable)
      .sort((a, b) => TARGET_PRIORITY[b.type] - TARGET_PRIORITY[a.type])[0];
}

export function findAllEntitiesAt(state: GameState, x: number, y: number): Entity[] {
  return Array.from(state.entities.values())
      .filter(e => e.x === x && e.y === y);
}

/**
 * Возвращает true, если клетка в (x, y) блокирует движение.
 */
export function isBlocked(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return true;
  const tile = state.map.tiles[y]?.[x];
  if (tile === 'wall') return true;
  return findAllEntitiesAt(state, x, y).filter(e => e.blocksMovement).length !== 0;
}

/**
 * Возвращает true, если клетка в (x, y) блокирует линию видимости.
 */
export function blocksLOS(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return true;
  const tile = state.map.tiles[y]?.[x];
  return tile === 'wall';
}


/**
 * Возвращает текущую позицию игрока.
 */
export function playerPos(state: GameState): Position {
  return { x: state.player.x, y: state.player.y };
}

/**
 * Возвращает лестницу на заданной клетке или undefined.
 */
export function findStairsAt(state: GameState, x: number, y: number, templateId?: string): import('./types').StairsEntity | undefined {
  const entities = findAllEntitiesAt(state, x, y);
  return entities
    .filter((e): e is import('./types').StairsEntity => e.type === 'stairs' && (!templateId || e.templateId === templateId))
    [0];
}

/**
 * Генерирует уникальный ID сущности с заданным префиксом.
 * Использует монотонный счётчик состояния — детерминирован между сохранениями.
 */
export function nextEntityId(state: GameState, prefix: string): EntityId {
  const counter = ++state.nextEntityCounter;
  return `${prefix}_${counter}`;
}

/**
 * Type guard: проверяет, что сущность — игрок или враг (CombatEntity).
 * Используется в skill executors перед вызовом damageFormulas.
 */
export function isCombatEntity(e: Entity): e is PlayerEntity | EnemyEntity {
  return e.type === 'player' || e.type === 'enemy';
}
