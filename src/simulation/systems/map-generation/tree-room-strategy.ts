/**
 * Стратегия генерации карты: дерево комнат.
 *
 * Алгоритм:
 * 1. Строится дерево комнат. Корень — spawn room. У каждого узла от 1 до 3 детей.
 *    Каждая комната знает глубину — расстояние до корня.
 * 2. К самому дальнему от спавна узлу добавляется дополнительная комната-выход.
 * 3. Комнаты размещаются на бесконечной сетке стен рядом с родителями.
 *    Каждая новая комната и коридор к ней:
 *    - прокладываются только по клеткам, которые ещё являются стенами;
 *    - имеют отступ в 1 тайл от любых уже существующих комнат и коридоров.
 * 4. Коридор может иметь произвольную форму (прямой, L-образный, зигзаг и т.д.),
 *    главное — ширина в 1 тайл и отсутствие пересечений.
 * 5. После размещения всего дерева карта нормализуется: сдвигается в положительные
 *    координаты и обрезается по bounding box с внешней стеной толщиной 1 тайл.
 *    При этом tree не ограничивается исходными width/height из MapParams —
 *    карта расширяется настолько, насколько требуется дереву.
 * 6. Старт игрока — центр корневой комнаты, лестница вниз — центр exit-комнаты.
 *    Враги и предметы спавнятся обычной логикой.
 */

import type {MapParams} from '@content/schemas';
import type {Corridor, CorridorSegment, DoorEntity, GameMap, GameState, RNGState, Room} from '@simulation/types';
import {rngInt, rngShuffle} from '@utils/rng';
import {createTileGrid} from '@simulation/state';
import type {GeneratedMap, MapGenerationStrategy} from './types';
import {carveHCorridor, carveRoom, carveVCorridor, createDoor, roomCenter, spawnEnemiesAndItems,} from './shared';

/** Узел дерева комнат. Содержит топологию и ссылку на размещённую Room. */
type TreeNode = {
  id: number;
  depth: number;
  room: Room | null;
  parent: TreeNode | null;
  children: TreeNode[];
  isExit: boolean;
};

/** Путь коридора как последовательность клеток шириной 1. */
type CorridorPath = { x: number; y: number }[];

/** Результат размещения: комната и коридор, ведущий к ней от родителя. */
type Placement = {
  room: Room;
  corridor: CorridorPath;
};

/** Размещённое дерево: списки комнат/коридоров, отображение узел → комната и позиции дверей. */
type Layout = {
  rooms: Room[];
  corridors: CorridorPath[];
  nodeToRoom: Map<TreeNode, Room>;
  doorPositions: { x: number; y: number }[];
};

const SIDE_LEFT = 0;
const SIDE_RIGHT = 1;
const SIDE_TOP = 2;
const SIDE_BOTTOM = 3;

export const treeRoomStrategy: MapGenerationStrategy = {
  id: 'tree',

  generate(params: MapParams, state: GameState, currentFloor: number): GeneratedMap {
    const rng = state.rng;

    const { root, exitNode } = buildRoomTree(params, rng);
    const layout = buildLayout(root, params, rng);
    const { map, nodeToRoom: shiftedNodeToRoom, doorPositions: shiftedDoorPositions } = buildGameMap(layout);

    const rootRoom = shiftedNodeToRoom.get(root)!;
    const playerStart = roomCenter(rootRoom);

    let stairsDown: { x: number; y: number } | null = null;
    if (exitNode) {
      const exitRoom =
        shiftedNodeToRoom.get(exitNode) ??
        (exitNode.parent ? shiftedNodeToRoom.get(exitNode.parent) : undefined);
      if (exitRoom) {
        stairsDown = roomCenter(exitRoom);
      }
    }
    const stairsUp = currentFloor > 1 ? playerStart : null;

    const { enemies, items } = spawnEnemiesAndItems(rng, map.rooms, params, state);
    const doors = buildDoors(shiftedDoorPositions, state);

    return {
      map,
      playerStart,
      stairsDown,
      stairsUp,
      enemies,
      items,
      doors,
    };
  },
};

// ─────────────────────────────────────────────
// Построение дерева комнат
// ─────────────────────────────────────────────

/**
 * Строит дерево комнат.
 *
 * - Корень всегда один и имеет глубину 0.
 * - Каждый узел получает от 1 до 3 детей, пока не достигнуто целевое
 *   количество комнат (rngInt между minRooms и maxRooms).
 * - После построения дерева к одному из самых дальних узлов добавляется
 *   дополнительная комната-выход (exit room).
 */
function buildRoomTree(params: MapParams, rng: RNGState): { root: TreeNode; exitNode: TreeNode | null } {
  const targetRooms = rngInt(rng, params.minRooms, params.maxRooms);
  let nextId = 0;

  const root: TreeNode = {
    id: nextId++,
    depth: 0,
    room: null,
    parent: null,
    children: [],
    isExit: false,
  };

  let totalNodes = 1;
  const queue: TreeNode[] = [root];

  while (totalNodes < targetRooms && queue.length > 0) {
    const node = queue.shift()!;
    const maxChildren = Math.min(3, targetRooms - totalNodes);
    if (maxChildren <= 0) break;

    const numChildren = rngInt(rng, 1, maxChildren);
    for (let i = 0; i < numChildren; i++) {
      const child: TreeNode = {
        id: nextId++,
        depth: node.depth + 1,
        room: null,
        parent: node,
        children: [],
        isExit: false,
      };
      node.children.push(child);
      queue.push(child);
      totalNodes++;
    }
  }

  const furthest = findFurthestNodes(root);
  let exitNode: TreeNode | null = null;

  if (furthest.length > 0) {
    const exitParent = furthest[rngInt(rng, 0, furthest.length - 1)]!;
    exitNode = {
      id: nextId++,
      depth: exitParent.depth + 1,
      room: null,
      parent: exitParent,
      children: [],
      isExit: true,
    };
    exitParent.children.push(exitNode);
  }

  return { root, exitNode };
}

/** Возвращает все узлы с максимальной глубиной. */
function findFurthestNodes(root: TreeNode): TreeNode[] {
  let maxDepth = -1;
  const result: TreeNode[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth > maxDepth) {
      maxDepth = node.depth;
      result.length = 0;
      result.push(node);
    } else if (node.depth === maxDepth) {
      result.push(node);
    }
    queue.push(...node.children);
  }

  return result;
}

/** Обходит дерево в ширину и возвращает все узлы в порядке удаления от корня. */
function collectNodes(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    queue.push(...node.children);
  }

  return result;
}

// ─────────────────────────────────────────────
// Размещение комнат и коридоров
// ─────────────────────────────────────────────

/**
 * Размещает все комнаты дерева на виртуальной сетке.
 *
 * Каждая дочерняя комната сначала пытается разместиться рядом с родителем
 * с коротким прямым коридором. Если не получается из-за занятых клеток
 * или отступа — ищется любая свободная позиция в радиусе searchRadius,
 * до которой можно достроить коридор по произвольному пути (BFS).
 */
function buildLayout(root: TreeNode, params: MapParams, rng: RNGState): Layout {
  const rooms: Room[] = [];
  const corridors: CorridorPath[] = [];
  const doorPositions: { x: number; y: number }[] = [];
  const nodeToRoom = new Map<TreeNode, Room>();
  const occupied = new Set<string>();
  const roomPadding = new Set<string>();

  const rootW = rngInt(rng, params.minRoomSize, params.maxRoomSize);
  const rootH = rngInt(rng, params.minRoomSize, params.maxRoomSize);
  const rootRoom: Room = { x: 0, y: 0, width: rootW, height: rootH };
  rooms.push(rootRoom);
  nodeToRoom.set(root, rootRoom);
  markRoomOccupied(rootRoom, occupied);
  markRoomPadding(rootRoom, roomPadding);

  const nodes = collectNodes(root).slice(1);

  for (const node of nodes) {
    const parentRoom = node.parent ? nodeToRoom.get(node.parent) : null;
    if (!parentRoom) continue;

    const childW = rngInt(rng, params.minRoomSize, params.maxRoomSize);
    const childH = rngInt(rng, params.minRoomSize, params.maxRoomSize);

    let placement = tryPlaceChildDirect(parentRoom, childW, childH, occupied, roomPadding, rng);
    if (!placement) {
      placement = tryPlaceChildWithBFS(parentRoom, childW, childH, occupied, roomPadding, rng, 25);
    }
    if (!placement && node.isExit) {
      // Для exit-комнаты ищем место в более широком радиусе.
      placement = tryPlaceChildWithBFS(parentRoom, childW, childH, occupied, roomPadding, rng, 60);
    }

    if (placement) {
      rooms.push(placement.room);
      corridors.push(placement.corridor);
      nodeToRoom.set(node, placement.room);
      markRoomOccupied(placement.room, occupied);
      markRoomPadding(placement.room, roomPadding);
      markCorridorOccupied(placement.corridor, occupied);

      // Двери ставятся на обоих концах коридора. Если коридор состоит из одной
      // клетки (расстояние между комнатами 1 тайл), ставится одна дверь.
      doorPositions.push(...collectDoorPositions(placement.corridor));
    }
  }

  return { rooms, corridors, nodeToRoom, doorPositions };
}

/**
 * Пытается разместить дочернюю комнату с коротким прямым коридором
 * от одной из стен родителя.
 */
function tryPlaceChildDirect(
  parent: Room,
  childW: number,
  childH: number,
  occupied: Set<string>,
  roomPadding: Set<string>,
  rng: RNGState,
): Placement | null {
  const sides = [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM];
  rngShuffle(rng, sides);

  for (const side of sides) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const gap = pickCorridorGap(rng);
      const result = computeDirectPlacement(parent, childW, childH, side, gap, rng);
      if (!result) continue;

      const { room, corridor } = result;
      // Коридор длины 2 запрещён: в нём не поместятся две двери на входе и выходе.
      if (corridor.length === 2) continue;
      const parentCells = getRoomCells(parent);
      const roomCells = getRoomCells(room);
      const parentPadding = getRoomPadding(parent);
      const allowed = unionSets(parentCells, roomCells);
      const forbidden = allowed;
      const emptyNeighbors = new Set<string>();

      const corridorValid = corridor.every((p, index) => {
        const isStart = index === 0;
        const isGoal = index === corridor.length - 1;
        const allowedNeighbors = isStart ? parentCells : isGoal ? roomCells : emptyNeighbors;
        return canPlaceCorridorCell(p.x, p.y, occupied, forbidden, allowedNeighbors);
      });
      // allowedPadding содержит только padding родителя: собственный padding
      // новой комнаты не должен пересекаться с padding других комнат.
      const roomValid = canPlaceRoom(room, occupied, roomPadding, allowed, parentPadding);

      if (corridorValid && roomValid) {
        return { room, corridor };
      }
    }
  }

  return null;
}

/**
 * Выбирает допустимую длину коридора: либо 1 тайл (одна дверь),
 * либо 3 и более (две двери). Длина 2 тайла запрещена.
 */
function pickCorridorGap(rng: RNGState, maxGap = 6): number {
  // 30% шанс на короткий коридор в 1 тайл, иначе — длинный коридор 3–6 тайлов.
  if (rngInt(rng, 1, 100) <= 30) return 1;
  return rngInt(rng, 3, maxGap);
}

/**
 * Вычисляет позицию дочерней комнаты и набор клеток прямого коридора
 * для заданной стороны родителя и зазора.
 */
function computeDirectPlacement(
  parent: Room,
  childW: number,
  childH: number,
  side: number,
  gap: number,
  rng: RNGState,
): Placement | null {
  let startX: number;
  let startY: number;
  let roomX: number;
  let roomY: number;
  const corridor: CorridorPath = [];

  switch (side) {
    case SIDE_BOTTOM:
      startX = parent.x + rngInt(rng, 0, parent.width - 1);
      startY = parent.y + parent.height;
      roomX = startX - rngInt(rng, 0, childW - 1);
      roomY = startY + gap;
      for (let y = startY; y < startY + gap; y++) corridor.push({ x: startX, y });
      break;
    case SIDE_TOP:
      startX = parent.x + rngInt(rng, 0, parent.width - 1);
      startY = parent.y - 1;
      roomX = startX - rngInt(rng, 0, childW - 1);
      roomY = startY - gap - childH + 1;
      for (let y = startY; y > startY - gap; y--) corridor.push({ x: startX, y });
      break;
    case SIDE_RIGHT:
      startX = parent.x + parent.width;
      startY = parent.y + rngInt(rng, 0, parent.height - 1);
      roomX = startX + gap;
      roomY = startY - rngInt(rng, 0, childH - 1);
      for (let x = startX; x < startX + gap; x++) corridor.push({ x, y: startY });
      break;
    case SIDE_LEFT:
      startX = parent.x - 1;
      startY = parent.y + rngInt(rng, 0, parent.height - 1);
      roomX = startX - gap - childW + 1;
      roomY = startY - rngInt(rng, 0, childH - 1);
      for (let x = startX; x > startX - gap; x--) corridor.push({ x, y: startY });
      break;
    default:
      return null;
  }

  const room: Room = { x: roomX, y: roomY, width: childW, height: childH };
  return { room, corridor };
}

/**
 * Ищет место для дочерней комнаты в заданном радиусе от родителя
 * и прокладывает к ней коридор произвольной формы через BFS.
 */
function tryPlaceChildWithBFS(
  parent: Room,
  childW: number,
  childH: number,
  occupied: Set<string>,
  roomPadding: Set<string>,
  rng: RNGState,
  searchRadius: number,
): Placement | null {
  const parentCells = getRoomCells(parent);
  const parentPadding = getRoomPadding(parent);
  const candidates: Room[] = [];

  for (let y = parent.y - searchRadius; y <= parent.y + parent.height + searchRadius; y++) {
    for (let x = parent.x - searchRadius; x <= parent.x + parent.width + searchRadius; x++) {
      const room: Room = { x, y, width: childW, height: childH };
      const roomCells = getRoomCells(room);
      const allowed = unionSets(parentCells, roomCells);
      if (canPlaceRoom(room, occupied, roomPadding, allowed, parentPadding)) {
        candidates.push(room);
      }
    }
  }

  if (candidates.length === 0) return null;

  rngShuffle(rng, candidates);

  for (let i = 0; i < Math.min(candidates.length, 40); i++) {
    const room = candidates[i]!;
    const roomCells = getRoomCells(room);
    const allowed = unionSets(parentCells, roomCells);
    const forbidden = unionSets(parentCells, roomCells);

    const starts = getWallExitCells(parent, occupied, forbidden, parentCells);
    const goals = getWallExitCells(room, occupied, forbidden, roomCells);

    // canPlaceRoom уже проверена для этой позиции, но оставим её здесь для ясности.
    if (!canPlaceRoom(room, occupied, roomPadding, allowed, parentPadding)) continue;
    if (starts.length === 0 || goals.length === 0) continue;

    for (let sAttempt = 0; sAttempt < 8; sAttempt++) {
      const start = starts[rngInt(rng, 0, starts.length - 1)]!;
      const goal = goals[rngInt(rng, 0, goals.length - 1)]!;
      const corridor = bfsCorridor(start, goal, occupied, forbidden, roomCells, rng);
      // Коридор длины 2 запрещён, так как в него не влезают две двери.
      if (corridor && corridor.length !== 2) {
        return { room, corridor };
      }
    }
  }

  return null;
}

/**
 * Возвращает клетки, примыкающие к стенам комнаты, в которые может начинаться
 * или заканчиваться коридор. Для каждой такой клетки проверяется,
 * что она и её окрестности свободны (с учётом allowed/forbidden).
 */
function getWallExitCells(
  room: Room,
  occupied: Set<string>,
  forbidden: Set<string>,
  allowedNeighbors: Set<string>,
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];

  for (let x = room.x; x < room.x + room.width; x++) {
    const top = { x, y: room.y - 1 };
    if (canPlaceCorridorCell(top.x, top.y, occupied, forbidden, allowedNeighbors)) cells.push(top);
  }
  for (let x = room.x; x < room.x + room.width; x++) {
    const bottom = { x, y: room.y + room.height };
    if (canPlaceCorridorCell(bottom.x, bottom.y, occupied, forbidden, allowedNeighbors))
      cells.push(bottom);
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    const left = { x: room.x - 1, y };
    if (canPlaceCorridorCell(left.x, left.y, occupied, forbidden, allowedNeighbors)) cells.push(left);
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    const right = { x: room.x + room.width, y };
    if (canPlaceCorridorCell(right.x, right.y, occupied, forbidden, allowedNeighbors))
      cells.push(right);
  }

  return cells;
}

/**
 * Прокладывает коридор шириной 1 от start до goal через BFS.
 * Путь проходит только по клеткам, для которых canPlaceCorridorCell возвращает true,
 * то есть не пересекает существующие комнаты/коридоры и сохраняет отступ 1 тайл.
 */
function bfsCorridor(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  occupied: Set<string>,
  forbidden: Set<string>,
  goalNeighbors: Set<string>,
  rng: RNGState,
): CorridorPath | null {
  const queue: CorridorPath[] = [[start]];
  const visited = new Set<string>([keyOf(start.x, start.y)]);
  const emptyNeighbors = new Set<string>();

  // Ограничиваем область поиска разумным прямоугольником вокруг start и goal,
  // чтобы BFS не уходил в бесконечный поиск при отсутствии пути.
  const dx = Math.abs(goal.x - start.x);
  const dy = Math.abs(goal.y - start.y);
  const padding = Math.max(dx, dy) + 10;
  const minX = Math.min(start.x, goal.x) - padding;
  const maxX = Math.max(start.x, goal.x) + padding;
  const minY = Math.min(start.y, goal.y) - padding;
  const maxY = Math.max(start.y, goal.y) + padding;

  while (queue.length > 0) {
    const path = queue.shift()!;
    const { x, y } = path[path.length - 1]!;

    if (x === goal.x && y === goal.y) return path;

    const directions = [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ];
    rngShuffle(rng, directions);

    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const k = keyOf(nx, ny);
      if (visited.has(k)) continue;
      const isGoal = nx === goal.x && ny === goal.y;
      const allowedNeighbors = isGoal ? goalNeighbors : emptyNeighbors;
      if (!canPlaceCorridorCell(nx, ny, occupied, forbidden, allowedNeighbors)) continue;
      visited.add(k);
      queue.push([...path, { x: nx, y: ny }]);
    }
  }

  return null;
}

/**
 * Проверяет, что прямоугольник комнаты вместе с отступом в 1 тайл
 * не пересекается с уже размещёнными комнатами/коридорами.
 * - roomPadding — клетки вокруг комнат (padding 1 тайл).
 * - occupied — полы комнат и коридоры.
 * - allowed / allowedPadding — клетки родительской и новой комнат,
 *   которые можно игнорировать (чтобы разрешить gap = 1 между ними).
 */
function canPlaceRoom(
  room: Room,
  occupied: Set<string>,
  roomPadding: Set<string>,
  allowed: Set<string>,
  allowedPadding: Set<string>,
): boolean {
  for (let y = room.y - 1; y < room.y + room.height + 1; y++) {
    for (let x = room.x - 1; x < room.x + room.width + 1; x++) {
      const k = keyOf(x, y);
      if (!allowedPadding.has(k) && roomPadding.has(k)) return false;
      if (!allowed.has(k) && occupied.has(k)) return false;
    }
  }
  return true;
}

/**
 * Проверяет, что клетка коридора не входит в запрещённые клетки
 * и все 8 её соседей свободны (являются стенами), за исключением клеток
 * из allowedNeighbors.
 *
 * Важно: forbidden проверяется и для самой клетки, и для соседей,
 * потому что целевая комната ещё может не быть в occupied.
 */
function canPlaceCorridorCell(
  x: number,
  y: number,
  occupied: Set<string>,
  forbidden: Set<string>,
  allowedNeighbors: Set<string>,
): boolean {
  if (forbidden.has(keyOf(x, y))) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const k = keyOf(x + dx, y + dy);
      if (!allowedNeighbors.has(k) && (occupied.has(k) || forbidden.has(k))) return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────
// Хелперы координат и множеств
// ─────────────────────────────────────────────

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function getRoomCells(room: Room): Set<string> {
  const set = new Set<string>();
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      set.add(keyOf(x, y));
    }
  }
  return set;
}

function markRoomOccupied(room: Room, occupied: Set<string>): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      occupied.add(keyOf(x, y));
    }
  }
}

/** Добавляет в roomPadding все клетки вокруг комнаты с отступом 1 тайл. */
function markRoomPadding(room: Room, roomPadding: Set<string>): void {
  for (let y = room.y - 1; y < room.y + room.height + 1; y++) {
    for (let x = room.x - 1; x < room.x + room.width + 1; x++) {
      roomPadding.add(keyOf(x, y));
    }
  }
}

/** Возвращает клетки padding'а вокруг комнаты (включая пол комнаты). */
function getRoomPadding(room: Room): Set<string> {
  const set = new Set<string>();
  for (let y = room.y - 1; y < room.y + room.height + 1; y++) {
    for (let x = room.x - 1; x < room.x + room.width + 1; x++) {
      set.add(keyOf(x, y));
    }
  }
  return set;
}

function markCorridorOccupied(corridor: CorridorPath, occupied: Set<string>): void {
  for (const p of corridor) {
    occupied.add(keyOf(p.x, p.y));
  }
}

function unionSets(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>(a);
  for (const v of b) result.add(v);
  return result;
}

/**
 * Возвращает позиции дверей для коридора: по одной на каждом конце.
 * Для коридора длины 1 — одна дверь на единственной клетке.
 */
function collectDoorPositions(corridor: CorridorPath): { x: number; y: number }[] {
  if (corridor.length === 0) return [];
  if (corridor.length === 1) return [corridor[0]!];
  return [corridor[0]!, corridor[corridor.length - 1]!];
}

/**
 * Создаёт закрытые двери на указанных позициях.
 * Пропускает позицию, если в радиусе 1 клетки (включая диагонали)
 * уже есть другая дверь.
 */
function buildDoors(
  positions: { x: number; y: number }[],
  state: GameState,
): DoorEntity[] {
  const doors: DoorEntity[] = [];

  for (const pos of positions) {
    const hasNearby = doors.some(
      d => Math.abs(d.x - pos.x) <= 1 && Math.abs(d.y - pos.y) <= 1,
    );
    if (!hasNearby) {
      doors.push(createDoor(state, 'wooden_door', pos.x, pos.y));
    }
  }

  return doors;
}

// ─────────────────────────────────────────────
// Построение финальной GameMap
// ─────────────────────────────────────────────

/**
 * Превращает размещённое дерево в готовую GameMap.
 *
 * Находит bounding box всех комнат и коридоров, добавляет внешнюю
 * стену толщиной 1 тайл, сдвигает координаты в положительную область
 * и вырезает тайлы. Размер результата определяется содержимым,
 * а не исходными width/height из MapParams.
 */
function buildGameMap(layout: Layout): { map: GameMap; nodeToRoom: Map<TreeNode, Room>; doorPositions: { x: number; y: number }[] } {
  const { rooms, corridors } = layout;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x - 1);
    minY = Math.min(minY, room.y - 1);
    maxX = Math.max(maxX, room.x + room.width);
    maxY = Math.max(maxY, room.y + room.height);
  }

  for (const corridor of corridors) {
    for (const p of corridor) {
      minX = Math.min(minX, p.x - 1);
      minY = Math.min(minY, p.y - 1);
      maxX = Math.max(maxX, p.x + 1);
      maxY = Math.max(maxY, p.y + 1);
    }
  }

  const padding = 1;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  const width = maxX - minX + 1 + padding * 2;
  const height = maxY - minY + 1 + padding * 2;

  const tiles = createTileGrid(width, height);

  const shiftedRooms: Room[] = [];
  const shiftedNodeToRoom = new Map<TreeNode, Room>();
  const shiftedDoorPositions = layout.doorPositions.map(p => ({
    x: p.x + offsetX,
    y: p.y + offsetY,
  }));

  for (const [node, room] of layout.nodeToRoom) {
    const shifted: Room = {
      x: room.x + offsetX,
      y: room.y + offsetY,
      width: room.width,
      height: room.height,
    };
    shiftedRooms.push(shifted);
    shiftedNodeToRoom.set(node, shifted);
    carveRoom(tiles, shifted);
  }

  const shiftedCorridors: Corridor[] = [];
  for (const corridor of corridors) {
    const shiftedPath = corridor.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
    const segments: CorridorSegment[] = [];

    if (shiftedPath.length === 1) {
      // Коридор из одной клетки (расстояние между комнатами 1 тайл).
      const p = shiftedPath[0]!;
      tiles[p.y]![p.x] = 'floor';
      segments.push({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else {
      for (let i = 1; i < shiftedPath.length; i++) {
        const a = shiftedPath[i - 1]!;
        const b = shiftedPath[i]!;
        segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

        if (a.x === b.x) {
          carveVCorridor(tiles, a.y, b.y, a.x);
        } else if (a.y === b.y) {
          carveHCorridor(tiles, a.x, b.x, a.y);
        }
      }
    }

    shiftedCorridors.push({ segments });
  }

  const map: GameMap = { width, height, tiles, rooms: shiftedRooms, corridors: shiftedCorridors };
  return { map, nodeToRoom: shiftedNodeToRoom, doorPositions: shiftedDoorPositions };
}
