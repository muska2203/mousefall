/**
 * Тактические утилиты передвижения и ближнего боя.
 *
 * Ответственность:
 * - Превращать высокоуровневые решения стратегии
 *   («подойти к цели», «атаковать вплотную») в конкретные GameAction.
 *
 * Правила:
 * - Функции чистые, детерминированы при одинаковом state.
 * - Не мутируют aiState и не эмитят событий.
 * - Не решают, кого атаковать — только выполняют команду стратегии.
 */

import type { GameState, EnemyEntity, Position } from '@simulation/types';
import type { MoveAction, AttackAction } from '@simulation/core-types';
import { isBlocked } from '@simulation/state';
import { chebyshevDistance, findPath } from '@utils/math';
import type { CloseCombatResult, MoveTowardResult } from './types';

/** Максимальное число рассматриваемых узлов A*. */
const DEFAULT_PATHFINDING_LIMIT = 200;

/** Разрешать диагональное движение при поиске пути. */
const DEFAULT_ALLOW_DIAGONAL = true;

/**
 * Возвращает действие ATTACK в направлении цели.
 *
 * Не проверяет дистанцию и не валидирует цель — это ответственность
 * action handler'а `attackEntity`. Стратегия должна сама убедиться,
 * что цель в пределах досягаемости.
 *
 * Защита: если цель совпадает с позицией актора, бросает ошибку,
 * так как ATTACK с (dx: 0, dy: 0) невалиден.
 */
export function attackTarget(actor: EnemyEntity, target: Position): AttackAction {
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;

  if (dx === 0 && dy === 0) {
    throw new Error(
      `attackTarget: target position (${target.x}, ${target.y}) coincides with actor ${actor.id}`,
    );
  }

  return {
    type: 'ATTACK',
    entityId: actor.id,
    dx: Math.sign(dx),
    dy: Math.sign(dy),
  };
}

/**
 * Возвращает один шаг MOVE к указанной позиции по кратчайшему пути.
 *
 * Использует A* с диагональным движением. Если путь не найден —
 * возвращает 'blocked'.
 */
export function moveToward(
  actor: EnemyEntity,
  state: GameState,
  target: Position,
): MoveTowardResult {
  const path = findPath(
    { x: actor.x, y: actor.y },
    target,
    (pos) => !isBlocked(state, pos.x, pos.y),
    DEFAULT_PATHFINDING_LIMIT,
    DEFAULT_ALLOW_DIAGONAL,
  );

  if (!path || path.length === 0) {
    return { kind: 'blocked' };
  }

  const step = path[0]!;

  return {
    kind: 'move',
    action: {
      type: 'MOVE',
      entityId: actor.id,
      dx: step.x - actor.x,
      dy: step.y - actor.y,
    },
  };
}

/**
 * Подходит к цели вплотную и атакует.
 *
 * - Если цель в соседней клетке (расстояние Чебышёва = 1) — атакует.
 * - Иначе делает один шаг MOVE по кратчайшему пути.
 * - Если путь заблокирован — возвращает 'blocked'.
 */
export function closeCombat(
  actor: EnemyEntity,
  state: GameState,
  target: Position,
): CloseCombatResult {
  const distance = chebyshevDistance(
    { x: actor.x, y: actor.y },
    target,
  );

  if (distance === 1) {
    return {
      kind: 'attack',
      action: attackTarget(actor, target),
    };
  }

  const moveResult = moveToward(actor, state, target);

  if (moveResult.kind === 'move') {
    return moveResult;
  }

  return { kind: 'blocked' };
}
