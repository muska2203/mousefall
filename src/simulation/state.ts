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
  DoorEntity,
  EnemyEntity,
  Entity,
  EntityId,
  EntityInteractionKind,
  EntityType,
  FactionId,
  GameState,
  PlayerEntity,
  Position,
  PropEntity,
  TileType,
} from './types';
import type {MapParams} from '@content/schemas';
import type {TileEffectInstance} from './core-types.ts';
import {createRNG} from '../utils/rng';
import {PLAYER_ID} from '../utils/constants';
import {tryGetPlayerTemplate, tryGetTerrain, tryGetTileEffect} from '@content/registry';
import {DEFAULT_WALL_TERRAIN} from './systems/map-generation/shared.ts';
import {rebuildActiveRules} from './systems/rules/active-rule-lifecycle.ts';

// ─────────────────────────────────────────────
// Фабрика начального состояния
// ─────────────────────────────────────────────

/**
 * Создаёт начальное игровое состояние для новой игры.
 * Генерация карты здесь НЕ выполняется — вызовите generateMap() отдельно
 * и передайте результат в createStateForFloor().
 */
export function createInitialPlayer(templateId: string): PlayerEntity {
  const template = tryGetPlayerTemplate(templateId);
  // Fallback совпадает со значением по умолчанию в PlayerTemplateSchema.
  const startingMaxAp = template?.maxAp ?? 2;

  const player: PlayerEntity = {
    id: PLAYER_ID,
    type: 'player',
    blocksMovement: true,
    displayName: templateId,
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
    equippedWeaponInstanceId: null,
    equippedArmorInstanceId: null,
    equippedAmuletInstanceId: null,
    isAlive: true,
    factionId: 'player',
    ap: startingMaxAp,
    maxAp: startingMaxAp,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    abilities: [],
    activeRules: [],
  };

  rebuildActiveRules(player);
  return player;
}

/**
 * Создаёт пустую двумерную булеву сетку (для массивов visible/explored).
 */
export function createBoolGrid(width: number, height: number, value: boolean): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(value));
}

/**
 * Создаёт пустую двумерную сетку тайлов, заполненную террейном стены по умолчанию.
 */
export function createTileGrid(width: number, height: number): TileType[][] {
  return Array.from({ length: height }, () => Array<TileType>(width).fill(DEFAULT_WALL_TERRAIN));
}

/**
 * Создаёт пустую двумерную сетку тайловых эффектов.
 */
export function createTileEffectsGrid(width: number, height: number): import('@simulation/core-types.ts').TileEffects[][] {
  return Array.from({ length: height }, () => Array(width).fill(null).map(() => ({})));
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
      corridors: [],
    },
    tileEffects: createTileEffectsGrid(mapWidth, mapHeight),
    mapParams,
    entities: new Map<EntityId, Entity>([[player.id, player]]),
    player: player,
    visible: createBoolGrid(mapWidth, mapHeight, false),
    explored: createBoolGrid(mapWidth, mapHeight, false),
    turn: {round: 1, activeSide: 'player'},
    phase: 'playing',
    floor: 1,
    floorSnapshots: [],
    rng: createRNG(seed),
    runtimeRng: createRNG(seed),
    nextEntityCounter: 0,
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
      defeatedBossIds: [],
    },
    featureFlags: {
      contentRulesEnabled: true,
    },
  };
}

// ─────────────────────────────────────────────
// Локальный позиционный индекс сущностей
// ─────────────────────────────────────────────

/**
 * Ключ клетки позиционного индекса.
 */
export function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Позиционный индекс: клетка → сущности на ней.
 *
 * Локальная производная структура: строится за O(N) на время одного пересчёта
 * (FOV, pathfinding) и не хранится в GameState. Порядок сущностей внутри клетки
 * совпадает с порядком обхода `entities`, поэтому результат эквивалентен
 * `findAllEntitiesAt` без индекса.
 */
export type EntityPositionIndex = Map<string, Entity[]>;

/**
 * Строит позиционный индекс из реестра сущностей.
 */
export function buildEntityPositionIndex(entities: Map<EntityId, Entity>): EntityPositionIndex {
  const index: EntityPositionIndex = new Map();
  for (const entity of entities.values()) {
    const key = positionKey(entity.x, entity.y);
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(entity);
    } else {
      index.set(key, [entity]);
    }
  }
  return index;
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
  if (foundEntity && 'hp' in foundEntity && foundEntity.isAlive) {
    return foundEntity as Entity & Attackable;
  }
  return undefined;
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
      .filter(e => e.isAlive)
      // Детерминированный порядок обработки — важен для воспроизводимости.
      .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Возвращает всех живых акторов указанной фракции, отсортированных по id.
 */
export function findAllAliveActorsOfFaction(state: GameState, factionId: FactionId) {
  return Array.from(state.entities.values())
      .filter((e): e is Extract<Entity, Actor> => isActor(e))
      .filter(actor => actor.isAlive && actor.factionId === factionId)
      .sort((a, b) => a.id.localeCompare(b.id));
}

export const TARGET_PRIORITY: Record<EntityType, number> = {
  player: 100,
  enemy: 90,
  door: 50,
  prop: 40,
  floor_item_container: 0,
  stairs: 0,
  poi: 0,
};

/**
 * Type guard: проверяет, что сущность может получать урон (есть hp и она жива).
 * Используется для скиллов, урона и рукопашных атак по любым damageable-объектам.
 */
export function isDamageable(e: Entity): e is Entity & Attackable {
  return 'hp' in e && (e as Entity & Attackable).isAlive;
}

export function findFirstAttackableEntityAt(state: GameState, x: number, y: number, index?: EntityPositionIndex): (Entity & Attackable) | undefined {
  return findAllEntitiesAt(state, x, y, index)
      .filter(isDamageable)
      .sort((a, b) => TARGET_PRIORITY[b.type] - TARGET_PRIORITY[a.type])[0];
}

/**
 * Возвращает все сущности на клетке (x, y).
 * Если передан позиционный индекс — O(1) по нему, иначе O(N) скан по реестру.
 */
export function findAllEntitiesAt(state: GameState, x: number, y: number, index?: EntityPositionIndex): Entity[] {
  if (index) {
    return index.get(positionKey(x, y)) ?? [];
  }
  return Array.from(state.entities.values())
      .filter(e => e.x === x && e.y === y);
}

/**
 * Возвращает тайловые эффекты клетки в виде производной записи
 * «ключ — тип эффекта» (ссылки на те же экземпляры, без копирования).
 * Хранение ведётся по слоям (TileEffects), это представление — для читателей,
 * которым нужен доступ по типу. Результат мутировать нельзя.
 * Для клетки вне карты возвращает пустой объект.
 */
export function getTileEffectsAt(state: GameState, x: number, y: number): Record<string, TileEffectInstance> {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return {};
  }
  const row = state.tileEffects[y];
  if (!row) return {};
  const cell = row[x];
  if (!cell) return {};
  const byType: Record<string, TileEffectInstance> = {};
  for (const effect of Object.values(cell)) {
    byType[effect.type] = effect;
  }
  return byType;
}

/**
 * Проверяет, проходим ли террейн для движения.
 * Fail-safe: неизвестный или отсутствующий id террейна считается непроходимым.
 */
export function isTerrainWalkable(terrainId: TileType | undefined): boolean {
  if (terrainId === undefined) return false;
  return tryGetTerrain(terrainId)?.walkable === true;
}

/**
 * Проверяет, есть ли у террейна указанный тег (например, 'ground' —
 * «на эту клетку можно ставить эффекты и спавнить объекты»).
 * Неизвестный id террейна тегов не имеет.
 */
export function terrainHasTag(terrainId: TileType | undefined, tag: string): boolean {
  if (terrainId === undefined) return false;
  return (tryGetTerrain(terrainId)?.tags ?? []).includes(tag);
}

/**
 * Возвращает true, если клетка в (x, y) блокирует движение.
 */
export function isBlocked(state: GameState, x: number, y: number, index?: EntityPositionIndex): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return true;
  if (!isTerrainWalkable(state.map.tiles[y]?.[x])) return true;
  return findAllEntitiesAt(state, x, y, index).filter(e => e.blocksMovement).length !== 0;
}

/**
 * Возвращает true, если клетка в (x, y) блокирует линию видимости.
 * Обзор блокируют слои независимо: террейн с blocksLOS, закрытая дверь,
 * проп с blocksLOS, тайловый эффект с blocksLOS (дым и т.п.).
 */
export function blocksLOS(state: GameState, x: number, y: number, index?: EntityPositionIndex): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return true;
  const tile = state.map.tiles[y]?.[x];
  if (tile !== undefined && tryGetTerrain(tile)?.blocksLOS === true) return true;
  const door = findDoorAt(state, x, y, index);
  if (door) {
    // Закрытая живая дверь блокирует обзор, открытая — нет.
    if (door.isAlive && !door.isOpen) return true;
  } else {
    const prop = findPropAt(state, x, y, index);
    // Живой проп с blocksLOS блокирует обзор.
    if (prop && prop.isAlive && prop.blocksLOS) return true;
  }
  // Тайловые эффекты с blocksLOS (дым и др.) блокируют обзор, но не движение.
  return Object.values(getTileEffectsAt(state, x, y))
    .some((effect) => tryGetTileEffect(effect.type)?.blocksLOS === true);
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
export function findStairsAt(state: GameState, x: number, y: number, templateId?: string, index?: EntityPositionIndex): import('./types').StairsEntity | undefined {
  const entities = findAllEntitiesAt(state, x, y, index);
  return entities
    .filter((e): e is import('./types').StairsEntity => e.type === 'stairs' && (!templateId || e.templateId === templateId))
    [0];
}

/**
 * Возвращает дверь на заданной клетке или undefined.
 */
export function findDoorAt(state: GameState, x: number, y: number, index?: EntityPositionIndex): DoorEntity | undefined {
  const entities = findAllEntitiesAt(state, x, y, index);
  return entities
    .filter((e): e is DoorEntity => e.type === 'door' && e.isAlive)[0];
}

/**
 * Возвращает проп на заданной клетке или undefined.
 */
export function findPropAt(state: GameState, x: number, y: number, index?: EntityPositionIndex): PropEntity | undefined {
  const entities = findAllEntitiesAt(state, x, y, index);
  return entities
    .filter((e): e is PropEntity => e.type === 'prop' && e.isAlive)[0];
}

/**
 * Возвращает точку интереса на заданной клетке или undefined.
 */
export function findPoiAt(state: GameState, x: number, y: number, index?: EntityPositionIndex): import('./types').PointOfInterestEntity | undefined {
  const entities = findAllEntitiesAt(state, x, y, index);
  return entities
    .filter((e): e is import('./types').PointOfInterestEntity => e.type === 'poi')[0];
}

// ─────────────────────────────────────────────
// Слоты размещения объектов (слой 4 слоистой модели клетки)
// ─────────────────────────────────────────────

/**
 * Слот размещения объекта на клетке.
 * - `solid` — дверь, проп, точка интереса. Несовместим со всеми другими объектами.
 * - `floorFixture` — лестница (в будущем — ловушка). Несовместим с `solid` и `floorFixture`.
 * - `loot` — контейнер лута. Совместим с `floorFixture`, максимум один `loot` на клетку.
 */
export type PlacementSlot = 'solid' | 'floorFixture' | 'loot';

/**
 * Выводит слот размещения из типа сущности.
 * Акторы (player/enemy) не являются объектами размещения и возвращают null.
 */
export function getPlacementSlot(entity: Entity): PlacementSlot | null {
  switch (entity.type) {
    case 'door':
    case 'prop':
    case 'poi':
      return 'solid';
    case 'stairs':
      return 'floorFixture';
    case 'floor_item_container':
      return 'loot';
    default:
      return null;
  }
}

/**
 * Единая проверка совместимости объектов на клетке.
 * Возвращает true, если объект с указанным слотом можно разместить в (x, y)
 * с учётом уже стоящих там объектов. Акторы слотами не ограничиваются.
 */
export function canPlaceObjectAt(
  state: GameState,
  slot: PlacementSlot,
  position: Position,
  index?: EntityPositionIndex,
): boolean {
  for (const entity of findAllEntitiesAt(state, position.x, position.y, index)) {
    const existing = getPlacementSlot(entity);
    if (existing === null) continue;
    // solid несовместим с любыми объектами на клетке (в обе стороны).
    if (existing === 'solid' || slot === 'solid') return false;
    // Одинаковые слоты не стакуются: floorFixture + floorFixture, loot + loot.
    if (existing === slot) return false;
  }
  return true;
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

/**
 * Type guard: проверяет, что сущность предоставляет взаимодействие.
 */
export function hasInteractionKind(entity: Entity): entity is Entity & { interactionKind: EntityInteractionKind } {
  return 'interactionKind' in entity;
}

/**
 * Возвращает все интерактивные сущности в радиусе от актора.
 * Радиус измеряется по шахматному расстоянию (Chebyshev distance).
 */
export function findInteractableEntitiesAround(
  state: GameState,
  actor: Entity,
  radius: number,
): Entity[] {
  return Array.from(state.entities.values()).filter((entity) => {
    if (!hasInteractionKind(entity)) return false;
    const dx = Math.abs(entity.x - actor.x);
    const dy = Math.abs(entity.y - actor.y);
    return Math.max(dx, dy) <= radius;
  });
}

/**
 * Гарантирует, что у состояния есть поле runStats.defeatedBossIds.
 * Используется при загрузке старых сохранений, где поле могло отсутствовать.
 */
export function ensureDefeatedBossIds(state: GameState): void {
  if (!state.runStats.defeatedBossIds) {
    state.runStats.defeatedBossIds = [];
  }
}
