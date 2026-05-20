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
 * Простой поиск пути в ширину (BFS). Возвращает следующий шаг к `to` или null, если цель недостижима.
 *
 * Используется ИИ для обхода препятствий.
 * Возвращает только СЛЕДУЮЩУЮ позицию для движения (не весь путь) — достаточно для пошагового ИИ.
 *
 * @param from - Начальная позиция
 * @param to - Целевая позиция
 * @param isWalkable - Возвращает true, если позицию можно пройти
 * @param maxSteps - Максимальная глубина BFS (предотвращает бесконечный поиск на больших картах)
 */
export function nextStepToward(
  from: Position,
  to: Position,
  isWalkable: (pos: Position) => boolean,
  maxSteps = 20,
): Position | null {
  if (posEqual(from, to)) return null;

  // Поиск в ширину (BFS)
  const queue: Array<{ pos: Position; firstStep: Position }> = [];
  const visited = new Set<string>();

  const key = (p: Position) => `${p.x},${p.y}`;
  visited.add(key(from));

  for (const delta of CARDINAL_DELTAS) {
    const neighbor = { x: from.x + delta.x, y: from.y + delta.y };
    if (!visited.has(key(neighbor)) && (isWalkable(neighbor) || posEqual(neighbor, to))) {
      queue.push({ pos: neighbor, firstStep: neighbor });
      visited.add(key(neighbor));
    }
  }

  let steps = 0;
  while (queue.length > 0 && steps < maxSteps) {
    const current = queue.shift()!;
    steps++;

    if (posEqual(current.pos, to)) {
      return current.firstStep;
    }

    for (const delta of CARDINAL_DELTAS) {
      const neighbor = { x: current.pos.x + delta.x, y: current.pos.y + delta.y };
      if (!visited.has(key(neighbor)) && (isWalkable(neighbor) || posEqual(neighbor, to))) {
        queue.push({ pos: neighbor, firstStep: current.firstStep });
        visited.add(key(neighbor));
      }
    }
  }

  return null; // Недостижимо в пределах maxSteps
}
