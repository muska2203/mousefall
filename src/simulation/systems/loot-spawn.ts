/**
 * Утилиты поиска свободной клетки для спавна предметов.
 *
 * Правила:
 * - Сначала ищет полностью пустую клетку (нет стен и нет вообще никаких сущностей)
 *   в радиусе 2 от origin.
 * - Если не нашёл — fallback: ближайшая клетка, не занятая блокирующими объектами
 *   и стенами, до maxRadius.
 * - Детерминированный fallback: если ничего не найдено, возвращает origin.
 */

import type { GameState } from '@simulation/types';
import type { Position } from '@simulation/core-types';
import { isBlocked, findAllEntitiesAt } from '@simulation/state';

function isCompletelyEmpty(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return false;
  const tile = state.map.tiles[y]?.[x];
  if (tile === 'wall') return false;
  return findAllEntitiesAt(state, x, y).length === 0;
}

function isNotBlocked(state: GameState, x: number, y: number): boolean {
  return !isBlocked(state, x, y);
}

function collectCandidates(
  state: GameState,
  origin: Position,
  radius: number,
  predicate: (state: GameState, x: number, y: number) => boolean,
): Position[] {
  const candidates: Position[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (predicate(state, x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  return candidates;
}

/**
 * Ищет ближайшую свободную клетку вокруг origin.
 *
 * @param state — текущее состояние игры
 * @param origin — начальная позиция
 * @param maxRadius — максимальный радиус fallback-поиска (по умолчанию 3)
 * @returns свободная позиция или origin, если ничего не найдено
 */
export function findFreeTileNear(
  state: GameState,
  origin: Position,
  maxRadius: number = 3,
): Position {
  // Этап 1: полностью пустая клетка (нет стен, нет сущностей) в радиусе 2
  for (let radius = 0; radius <= 2; radius++) {
    const candidates = collectCandidates(state, origin, radius, isCompletelyEmpty);
    if (candidates.length > 0) {
      return candidates[0]!;
    }
  }

  // Этап 2: fallback — клетка без блокирующих сущностей и стен
  for (let radius = 0; radius <= maxRadius; radius++) {
    const candidates = collectCandidates(state, origin, radius, isNotBlocked);
    if (candidates.length > 0) {
      return candidates[0]!;
    }
  }

  return origin;
}
