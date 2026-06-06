/**
 * Чистые математические утилиты для расчётов на сетке.
 *
 * Правила:
 * - Все функции чистые (нет побочных эффектов, нет состояния)
 * - Никакой игровой логики — только геометрические/пространственные вычисления
 * - Никаких импортов из simulation/ или ui/
 */

import type { Position } from '../simulation/types';

// ─────────────────────────────────────────────
// Расстояние
// ─────────────────────────────────────────────

/**
 * Расстояние Манхэттена: сумма модулей разностей.
 * Используется для: проверок дальности при движении в 4 направлениях.
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Расстояние Чебышёва: максимум из модулей разностей.
 * Используется для: проверок дальности при движении в 8 направлениях (стандарт рогалика).
 */
export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Квадрат евклидова расстояния (избегаем sqrt для производительности).
 * Используется для: сортировки по дальности без необходимости точных значений.
 */
export function distanceSq(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// ─────────────────────────────────────────────
// Границы
// ─────────────────────────────────────────────

/**
 * Возвращает true, если позиция находится внутри границ сетки [0, width) × [0, height).
 */
export function inBounds(pos: Position, width: number, height: number): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

/**
 * Ограничивает значение диапазоном [min, max] (включительно).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────
// Соседи
// ─────────────────────────────────────────────

/** 4 основных направления в виде дельт (dx, dy). */
export const CARDINAL_DELTAS: ReadonlyArray<Position> = [
  { x: 0,  y: -1 }, // North
  { x: 1,  y:  0 }, // East
  { x: 0,  y:  1 }, // South
  { x: -1, y:  0 }, // West
] as const;

/** Все 8 направлений (основные + диагональные) в виде дельт (dx, dy). */
export const ALL_DELTAS: ReadonlyArray<Position> = [
  { x: 0,  y: -1 }, // N
  { x: 1,  y: -1 }, // NE
  { x: 1,  y:  0 }, // E
  { x: 1,  y:  1 }, // SE
  { x: 0,  y:  1 }, // S
  { x: -1, y:  1 }, // SW
  { x: -1, y:  0 }, // W
  { x: -1, y: -1 }, // NW
] as const;

/**
 * Возвращает 4 соседа по сторонам света (без проверки границ).
 */
export function cardinalNeighbors(pos: Position): Position[] {
  return CARDINAL_DELTAS.map(d => ({ x: pos.x + d.x, y: pos.y + d.y }));
}

/**
 * Возвращает всех 8 соседей позиции (без проверки границ).
 */
export function allNeighbors(pos: Position): Position[] {
  return ALL_DELTAS.map(d => ({ x: pos.x + d.x, y: pos.y + d.y }));
}

// ─────────────────────────────────────────────
// Направление
// ─────────────────────────────────────────────

/**
 * Возвращает единичный шаг от `from` к `to` по Чебышёву (8 направлений).
 * Каждая компонента равна −1, 0 или 1.
 * Используется ИИ для перемещения на один шаг к цели.
 */
export function stepToward(from: Position, to: Position): Position {
  return {
    x: Math.sign(to.x - from.x),
    y: Math.sign(to.y - from.y),
  };
}

/**
 * Возвращает true, если две позиции совпадают.
 */
export function posEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

// ─────────────────────────────────────────────
// Поиск пути
// ─────────────────────────────────────────────

/**
 * Эвристика для A* (Чебышёв с весом диагонали).
 * Точная нижняя граница при стоимости прямого хода = 10, диагонального = 14.
 */
function chebyshevHeuristic(a: Position, b: Position): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
}

const keyOf = (p: Position) => `${p.x},${p.y}`;

/**
 * Восстанавливает путь из A* по таблице cameFrom.
 */
function reconstructPath(
  cameFrom: Map<string, string>,
  currentKey: string,
  startKey: string,
): Position[] {
  const path: Position[] = [];
  let k = currentKey;
  while (k !== startKey) {
    const parts = k.split(',').map(Number);
    path.push({ x: parts[0]!, y: parts[1]! });
    k = cameFrom.get(k)!;
  }
  path.reverse();
  return path;
}

/**
 * Поиск кратчайшего пути A* (8 направлений, разрешены диагонали).
 * Возвращает массив позиций от `from` (не включая) до `to` (включая),
 * или null, если цель недостижима.
 *
 * @param from - Начальная позиция
 * @param to - Целевая позиция
 * @param isWalkable - Возвращает true, если позицию можно пройти
 * @param maxSteps - Максимальное число рассмотренных узлов
 * @param allowDiagonal - Если true, доступны 8 направлений (включая диагонали)
 */
export function findPath(
  from: Position,
  to: Position,
  isWalkable: (pos: Position) => boolean,
  maxSteps = 200,
  allowDiagonal = true,
): Position[] | null {
  if (posEqual(from, to)) return [];

  const startKey = keyOf(from);
  const deltas = allowDiagonal ? ALL_DELTAS : CARDINAL_DELTAS;

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const openSet = new Map<string, number>(); // key -> fScore

  gScore.set(startKey, 0);
  openSet.set(startKey, chebyshevHeuristic(from, to));

  let visitedCount = 0;

  while (openSet.size > 0 && visitedCount < maxSteps) {
    // Извлекаем узел с минимальным fScore
    let currentKey: string | null = null;
    let currentF = Infinity;
    for (const [k, f] of openSet) {
      if (f < currentF) {
        currentF = f;
        currentKey = k;
      }
    }

    if (currentKey === null) break;

    const parts = currentKey.split(',').map(Number);
    const current = { x: parts[0]!, y: parts[1]! };

    if (posEqual(current, to)) {
      return reconstructPath(cameFrom, currentKey, startKey);
    }

    openSet.delete(currentKey);
    visitedCount++;

    const currentG = gScore.get(currentKey)!;

    for (const delta of deltas) {
      const neighbor = { x: current.x + delta.x, y: current.y + delta.y };
      const neighborKey = keyOf(neighbor);

      if (!isWalkable(neighbor) && !posEqual(neighbor, to)) {
        continue;
      }

      const stepCost = Math.abs(delta.x) + Math.abs(delta.y) === 2 ? 14 : 10;
      const tentativeG = currentG + stepCost;

      const neighborG = gScore.get(neighborKey) ?? Infinity;
      if (tentativeG < neighborG) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        openSet.set(neighborKey, tentativeG + chebyshevHeuristic(neighbor, to));
      }
    }
  }

  return null;
}


