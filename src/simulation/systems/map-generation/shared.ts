/**
 * Общие утилиты и фабрики сущностей для стратегий генерации карт.
 *
 * Содержит:
 * - Операции вырезания тайлов (carveRoom, carveHCorridor, carveVCorridor).
 * - Геометрические хелперы (roomCenter, randomPosInRoom).
 * - Наполнение комнат их типами (fillRooms, категория контента roomTypes).
 * - Фабрики сущностей (createEnemy, createFloorItem, createStairs, createDoor и т.д.).
 */

import type {
    DoorEntity,
    EnemyEntity,
    FloorItemContainerEntity,
    GameMap,
    GameState,
    PointOfInterestEntity,
    PropEntity,
    RNGState,
    Room,
    RuntimeAbility,
    StairsEntity,
    TileType,
    TrapEntity
} from '@simulation/types';
import type {Position, TileEffects} from '@simulation/core-types';
import type {RoomFill} from '@content/schemas';
import {rngChance, rngInt, rngPick, rngShuffle} from '@utils/rng';
import {buildEntityPositionIndex, canPlaceObjectAt, EntityPositionIndex, nextEntityId, PlacementSlot, terrainHasTag} from '@simulation/state';
import {createDefaultAIState} from '@simulation/ai/ai-state';
import {getDoor, getEntity, getItem, getPoi, getProp, getTrap, tryGetRoomType, tryGetTileEffect} from '@content/registry';
import {createFloorItemContainer} from '@simulation/systems/item-entity-factory';
import {createInventoryItem} from '@simulation/systems/inventory-factory';
import {addModifier} from '@simulation/systems/stats/modifier-engine';
import {recalculateActorStats} from '@simulation/systems/stats/recalculate';
import {rebuildActiveRules} from '@simulation/systems/rules/active-rule-lifecycle';
import {collectFixedStatModifiers} from '@simulation/systems/item-affix-roll';

// ─────────────────────────────────────────────
// Террейны по умолчанию
// ─────────────────────────────────────────────

/** Id террейна непроходимой стены (базовая геометрия карты до вырезания комнат). */
export const DEFAULT_WALL_TERRAIN: TileType = 'wall';

/** Id террейна обычного пола (вырезанные комнаты и коридоры). */
export const DEFAULT_FLOOR_TERRAIN: TileType = 'floor';

// ─────────────────────────────────────────────
// Вырезание тайлов
// ─────────────────────────────────────────────

export function carveRoom(tiles: TileType[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles[y]![x] = DEFAULT_FLOOR_TERRAIN;
    }
  }
}

export function carveHCorridor(tiles: TileType[][], x1: number, x2: number, y: number): void {
  const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = minX; x <= maxX; x++) {
    tiles[y]![x] = DEFAULT_FLOOR_TERRAIN;
  }
}

export function carveVCorridor(tiles: TileType[][], y1: number, y2: number, x: number): void {
  const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = minY; y <= maxY; y++) {
    tiles[y]![x] = DEFAULT_FLOOR_TERRAIN;
  }
}

// ─────────────────────────────────────────────
// Геометрические хелперы
// ─────────────────────────────────────────────

export function roomCenter(room: Room): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

export function randomPosInRoom(rng: RNGState, room: Room): { x: number; y: number } {
  return {
    x: rngInt(rng, room.x + 1, room.x + room.width - 2),
    y: rngInt(rng, room.y + 1, room.y + room.height - 2),
  };
}

// ─────────────────────────────────────────────
// Наполнение комнат их типами
// ─────────────────────────────────────────────

/** Результат наполнения комнат этажа их типами (см. fillRooms). */
export type FilledRooms = {
  enemies: EnemyEntity[];
  items: FloorItemContainerEntity[];
  props: PropEntity[];
  traps: TrapEntity[];
  pois: PointOfInterestEntity[];
};

/**
 * Наполняет комнаты карты по их типам (Room.roomTypeId, категория roomTypes).
 *
 * Порядок внутри комнаты: гарантированные poi → враги → предметы → пропы →
 * ловушки → лужи тайловых эффектов. Количество каждого вида — от площади
 * комнаты (ожидаемое = площадь/16 × плотность из шаблона типа). Объекты
 * размещаются через canPlaceObjectAt (слоты solid/floorFixture/loot);
 * клетка старта игрока исключается из размещения. Комнаты без roomTypeId
 * (тестовые моки) и неизвестные типы пропускаются.
 * Лужи пишутся в переданную сетку tileEffects новой карты; тайлы проверяются
 * по map, а не по state (state.map на момент генерации ещё старый).
 */
export function fillRooms(
  rng: RNGState,
  map: GameMap,
  state: GameState,
  playerStart: Position,
  tileEffects: TileEffects[][],
): FilledRooms {
  const result: FilledRooms = { enemies: [], items: [], props: [], traps: [], pois: [] };
  // Отслеживаем занятые тайлы, чтобы несколько врагов не спавнились в одной клетке.
  const occupied = new Set<string>();
  // Индекс уже размещённых сущностей — для проверки слотов размещения объектов.
  let placedIndex: EntityPositionIndex = new Map();
  const rebuildPlacedIndex = () => {
    placedIndex = buildEntityPositionIndex(new Map(
      [...result.enemies, ...result.items, ...result.props, ...result.traps, ...result.pois]
        .map(e => [e.id, e]),
    ));
  };
  const getPlacedIndex = () => placedIndex;

  for (const room of map.rooms) {
    if (!room.roomTypeId) continue;
    const roomType = tryGetRoomType(room.roomTypeId);
    if (!roomType || roomType.kind !== 'generated') continue;
    const fill = roomType.fill;
    const roomArea = room.width * room.height;

    // Гарантированные poi типа (например, алтарь выбора реликвии в стартовой комнате).
    for (const poiId of fill.guaranteedPois) {
      const pos = findFreeObjectCell(rng, room, state, 'solid', playerStart, getPlacedIndex, rebuildPlacedIndex);
      if (pos) result.pois.push(createPoi(state, poiId, pos.x, pos.y));
    }

    const enemyCount = rollCountFromArea(rng, roomArea, fill.enemyDensity);
    for (let i = 0; i < enemyCount; i++) {
      spawnEnemyInRoom(rng, room, fill.enemyPool, state, result.enemies, occupied, playerStart);
    }

    spawnPooledObjects(rng, room, state, playerStart, getPlacedIndex, rebuildPlacedIndex,
      fill.itemPool, rollCountFromArea(rng, roomArea, fill.itemDensity), 'loot',
      (templateId, pos) => result.items.push(createFloorItem(state, templateId, pos.x, pos.y)));
    spawnPooledObjects(rng, room, state, playerStart, getPlacedIndex, rebuildPlacedIndex,
      fill.propPool, rollCountFromArea(rng, roomArea, fill.propDensity), 'solid',
      (templateId, pos) => result.props.push(createProp(state, templateId, pos.x, pos.y)));
    spawnPooledObjects(rng, room, state, playerStart, getPlacedIndex, rebuildPlacedIndex,
      fill.trapPool, rollCountFromArea(rng, roomArea, fill.trapDensity), 'floorFixture',
      (templateId, pos) => result.traps.push(createTrap(state, templateId, pos.x, pos.y)));

    spawnTileEffectPatches(rng, room, map, fill, tileEffects);
  }

  return result;
}

/**
 * Переводит плотность в количество объектов: ожидаемое число =
 * (площадь комнаты / 16) × density; целая часть гарантирована, дробная — шансом.
 */
function rollCountFromArea(rng: RNGState, roomArea: number, density: number): number {
  const expected = (roomArea / 16) * density;
  const guaranteed = Math.floor(expected);
  const extraChance = expected - guaranteed;
  return guaranteed + (extraChance > 0 && rngChance(rng, extraChance * 100) ? 1 : 0);
}

/**
 * Ищет свободную клетку для объекта размещения (до 10 попыток).
 * Клетка старта игрока исключается. Индекс перестраивается перед каждой
 * проверкой, чтобы учесть объекты, размещённые на прошлых итерациях.
 */
function findFreeObjectCell(
  rng: RNGState,
  room: Room,
  state: GameState,
  slot: PlacementSlot,
  playerStart: Position,
  getIndex: () => EntityPositionIndex,
  rebuildIndex: () => void,
): Position | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pos = randomPosInRoom(rng, room);
    if (pos.x === playerStart.x && pos.y === playerStart.y) continue;
    rebuildIndex();
    if (canPlaceObjectAt(state, slot, pos, getIndex())) return pos;
  }
  return null;
}

/**
 * Размещает до count объектов из пула равномерным выбором на свободных клетках
 * комнаты в заданном слоте размещения.
 */
function spawnPooledObjects(
  rng: RNGState,
  room: Room,
  state: GameState,
  playerStart: Position,
  getIndex: () => EntityPositionIndex,
  rebuildIndex: () => void,
  pool: readonly string[],
  count: number,
  slot: PlacementSlot,
  create: (templateId: string, pos: Position) => void,
): void {
  if (pool.length === 0) return;
  for (let i = 0; i < count; i++) {
    const pos = findFreeObjectCell(rng, room, state, slot, playerStart, getIndex, rebuildIndex);
    // Комната забита — дальнейшие попытки бессмысленны.
    if (!pos) return;
    create(rngPick(rng, pool), pos);
  }
}

/**
 * Размещает пятна (лужи) тайловых эффектов из пула типа комнаты.
 * Пятно — центральная клетка + 0–2 случайных соседних (8-соседство) внутри
 * комнаты; ставится только на террейн с тегом 'ground' и только если слой
 * эффекта на клетке свободен (пятна одного слоя не перекрываются).
 */
function spawnTileEffectPatches(
  rng: RNGState,
  room: Room,
  map: GameMap,
  fill: RoomFill,
  tileEffects: TileEffects[][],
): void {
  if (fill.tileEffectPool.length === 0) return;
  const patchCount = rollCountFromArea(rng, room.width * room.height, fill.tileEffectDensity);

  for (let i = 0; i < patchCount; i++) {
    const effectId = rngPick(rng, fill.tileEffectPool);
    const template = tryGetTileEffect(effectId);
    if (!template) continue;

    const center = randomPosInRoom(rng, room);
    const cells: Position[] = [center];

    const neighbors: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = center.x + dx;
        const ny = center.y + dy;
        if (nx < room.x + 1 || nx > room.x + room.width - 2) continue;
        if (ny < room.y + 1 || ny > room.y + room.height - 2) continue;
        neighbors.push({ x: nx, y: ny });
      }
    }
    rngShuffle(rng, neighbors);
    const extraCells = rngInt(rng, 0, 2);
    for (let k = 0; k < Math.min(extraCells, neighbors.length); k++) {
      cells.push(neighbors[k]!);
    }

    for (const cell of cells) {
      if (!terrainHasTag(map.tiles[cell.y]?.[cell.x], 'ground')) continue;
      const cellEffects = tileEffects[cell.y]?.[cell.x];
      if (!cellEffects || cellEffects[template.layer]) continue;
      cellEffects[template.layer] = {
        type: template.id,
        duration: template.duration,
        layer: template.layer,
        statusEffects: [],
        renderOrder: template.renderOrder,
      };
    }
  }
}

/**
 * Пытается заспавнить одного врага внутри комнаты на свободном тайле.
 * Если подходящей клетки не нашлось (все заняты), враг не появляется.
 */
function spawnEnemyInRoom(
  rng: RNGState,
  room: Room,
  pool: readonly string[],
  state: GameState,
  enemies: EnemyEntity[],
  occupied: Set<string>,
  playerStart: Position,
): void {
  if (pool.length === 0) return;
  let pos = randomPosInRoom(rng, room);
  let key = `${pos.x},${pos.y}`;
  let attempts = 0;
  // Если тайл занят другим врагом или это старт игрока, пробуем подобрать
  // свободный, но не более 10 попыток.
  while ((occupied.has(key) || (pos.x === playerStart.x && pos.y === playerStart.y)) && attempts < 10) {
    pos = randomPosInRoom(rng, room);
    key = `${pos.x},${pos.y}`;
    attempts++;
  }

  occupied.add(key);
  enemies.push(createEnemy(state, rngPick(rng, pool), pos.x, pos.y));
}

// ─────────────────────────────────────────────
// Фабрики сущностей
// ─────────────────────────────────────────────

export function createEnemy(state: GameState, templateId: string, x: number, y: number): EnemyEntity {
  const template = getEntity(templateId);

  const abilities: RuntimeAbility[] = [];

  for (const abilityId of template.abilities ?? []) {
    abilities.push({
      templateId: abilityId,
      source: 'innate',
      level: 1,
      currentCooldown: 0,
    });
  }

  const enemy: EnemyEntity = {
    id: nextEntityId(state, 'enemy'),
    type: 'enemy',
    x,
    y,
    displayName: template.id,
    hp: template.health.max,
    maxHp: template.health.max,
    // Нейтральные значения: derived-кэш сразу пересчитывается
    // recalculateActorStats ниже (урон — из шаблона оружия, броня — из шаблона брони).
    damage: { min: 0, max: 0 },
    armor: 0,
    templateId,
    statusEffects: [],
    blocksMovement: true,
    maxAp: template.maxAp ?? 1,
    ap: template.maxAp ?? 1,
    isAlive: true,
    factionId: 'enemies',
    aiStrategyId: template.aiStrategyId ?? 'hunter',
    aiSightRadius: template.aiSightRadius,
    aiState: createDefaultAIState(template.aiStrategyId ?? 'hunter', { x, y }),
    baseStats: template.baseStats,
    baseMaxHp: template.health.max,
    statModifiers: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    critMultiplier: 1.5,
    abilities,
    activeRules: [],
  };

  const equipSlots = [
    { slot: 'weapon' as const, id: template.equipment?.weapon },
    { slot: 'armor' as const, id: template.equipment?.armor },
    { slot: 'amulet' as const, id: template.equipment?.amulet },
  ];

  for (const { slot, id } of equipSlots) {
    if (!id) continue;
    const itemTemplate = getItem(id);
    if (!itemTemplate) continue;

    if (slot === 'weapon') enemy.equippedWeaponId = id;
    else if (slot === 'armor') enemy.equippedArmorId = id;
    else enemy.equippedAmuletId = id;

    // Фирменные stat-модификаторы предмета (из fixedModifiers шаблона).
    for (const mod of collectFixedStatModifiers(itemTemplate)) {
      addModifier(enemy, { ...mod, source: `equipment_${slot}` });
    }

    for (const abilityId of itemTemplate.grantedAbilities ?? []) {
      enemy.abilities.push({
        templateId: abilityId,
        source: 'equipment',
        level: 1,
        currentCooldown: 0,
      });
    }
  }

  recalculateActorStats(enemy);
  enemy.hp = enemy.maxHp;

  rebuildActiveRules(enemy);

  return enemy;
}

export function createFloorItem(
  state: GameState,
  templateId: string,
  x: number,
  y: number,
): FloorItemContainerEntity {
  const inventoryItem = createInventoryItem(state, templateId);
  return createFloorItemContainer(state, inventoryItem, { x, y });
}

export function createStairs(
  state: GameState,
  templateId: string,
  direction: 'up' | 'down',
  x: number,
  y: number,
): StairsEntity {
  return {
    id: nextEntityId(state, 'stairs'),
    type: 'stairs',
    x,
    y,
    displayName: templateId,
    templateId,
    direction,
    blocksMovement: false,
    interactionKind: 'stairs',
  };
}

export function createDoor(state: GameState, templateId: string, x: number, y: number): DoorEntity {
  const template = getDoor(templateId);
  return {
    id: nextEntityId(state, 'door'),
    type: 'door',
    x,
    y,
    displayName: templateId,
    templateId,
    blocksMovement: true,
    interactionKind: 'door',
    isOpen: false,
    isLocked: false,
    hp: template.maxHp,
    maxHp: template.maxHp,
    armor: template.armor,
    isAlive: true,
    statusEffects: [],
  };
}

export function createProp(state: GameState, templateId: string, x: number, y: number): PropEntity {
  const template = getProp(templateId);
  return {
    id: nextEntityId(state, 'prop'),
    type: 'prop',
    x,
    y,
    displayName: templateId,
    templateId,
    blocksMovement: template.blocksMovement,
    blocksLOS: template.blocksLOS,
    interactionKind: 'prop',
    propKind: template.propKind,
    hp: template.maxHp,
    maxHp: template.maxHp,
    armor: template.armor,
    isAlive: true,
    statusEffects: [],
  };
}

export function createPoi(state: GameState, templateId: string, x: number, y: number): PointOfInterestEntity {
  const template = getPoi(templateId);
  return {
    id: nextEntityId(state, 'poi'),
    type: 'poi',
    x,
    y,
    displayName: templateId,
    templateId,
    blocksMovement: true,
    interactionKind: 'poi',
    charges: template.charges,
  };
}

export function createTrap(state: GameState, templateId: string, x: number, y: number): TrapEntity {
  const template = getTrap(templateId);
  return {
    id: nextEntityId(state, 'trap'),
    type: 'trap',
    x,
    y,
    displayName: templateId,
    templateId,
    blocksMovement: false,
    hidden: template.initiallyHidden,
  };
}
