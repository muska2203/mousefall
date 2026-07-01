/**
 * Чистые утилиты поиска пути для игрока.
 *
 * Ответственность:
 * - Построение кратчайшего пути от игрока до указанной цели.
 * - Учёт только видимых препятствий: невидимые объекты игнорируются.
 *
 * Правила:
 * - Не мутирует GameState.
 * - Не содержит UI-логики.
 * - Не зависит от внутренних API Simulation: все игровые проверки проходимости
 *   передаются через коллбэки из публичного API Simulation.
 */

import type { GameState, Position } from '@simulation/types';
import { findPath, posEqual } from '@utils/math';

/** Максимальное число рассматриваемых A*-узлов при поиске пути для игрока.
 * Защита от подвисаний на больших картах. */
const MAX_PATH_STEPS = 500;

/** Вид цели автопути. */
export type AutoPathTargetKind = 'move' | 'enemy' | 'door' | 'interactable';

/** Цель автопути: позиция, тип и (опционально) отслеживаемая сущность. */
export interface AutoPathTarget {
  position: Position;
  kind: AutoPathTargetKind;
  entityId: string | null;
}

/** Функция, определяющая, можно ли пройти через тайл. */
export type IsWalkableFn = (pos: Position) => boolean;

/**
 * Возвращает true, если тайл изведан (explored) и к нему можно строить preview-путь.
 */
export function isTileExplored(state: GameState, pos: Position): boolean {
  return state.explored[pos.y]?.[pos.x] ?? false;
}

/**
 * Проверяет, можно ли пройти через клетку при движении к целевой сущности.
 * Целевой тайл может быть непроходимым (враг, закрытая дверь), промежуточные — нет.
 * Для обычного движения по пустому тайлу целевая клетка тоже должна быть проходимой.
 */
export function isWalkableTowards(
  pos: Position,
  target: AutoPathTarget,
  isTileWalkable: IsWalkableFn,
): boolean {
  if (pos.x === target.position.x && pos.y === target.position.y) {
    return target.kind !== 'move';
  }
  return isTileWalkable(pos);
}

/**
 * Ищет путь к целевой сущности, которая сама может занимать непроходимый тайл
 * (враг, дверь). Промежуточные клетки должны быть проходимы.
 */
export function findPathTowards(
  start: Position,
  target: AutoPathTarget,
  isTileWalkable: IsWalkableFn,
): Position[] | null {
  if (posEqual(start, target.position)) {
    if (target.kind === 'move' && !isTileWalkable(target.position)) {
      return null;
    }
    return [];
  }

  const path = findPath(
    start,
    target.position,
    (pos) => isWalkableTowards(pos, target, isTileWalkable),
    MAX_PATH_STEPS,
    true,
  );
  if (!path) return null;

  if (target.kind === 'move' && !isTileWalkable(target.position)) {
    return null;
  }

  return path;
}
