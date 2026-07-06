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

import type { GameState, EnemyEntity, Position, DoorEntity } from '@simulation/types';
import type { MoveAction, AttackAction, InteractAction } from '@simulation/core-types';
import { isBlocked, findAllEntitiesAt, findDoorAt } from '@simulation/state';
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
 * Проверяет, может ли враг пройти клетку при поиске пути.
 * Закрытые двери считаются проходимыми — враг откроет их по пути.
 */
function isTilePassableForEnemy(state: GameState, pos: Position): boolean {
  if (pos.x < 0 || pos.x >= state.map.width || pos.y < 0 || pos.y >= state.map.height) {
    return false;
  }
  if (state.map.tiles[pos.y]?.[pos.x] === 'wall') {
    return false;
  }

  const blockers = findAllEntitiesAt(state, pos.x, pos.y).filter(e => e.blocksMovement);
  if (blockers.length === 0) return true;
  if (blockers.length !== 1) return false;

  const door = findDoorAt(state, pos.x, pos.y);
  return door !== undefined && door.isAlive !== false && !door.isOpen;
}

/**
 * Возвращает закрытую дверь на клетке или null.
 */
function findClosedDoorAt(state: GameState, x: number, y: number): DoorEntity | null {
  const door = findDoorAt(state, x, y);
  if (door && door.isAlive !== false && !door.isOpen) {
    return door;
  }
  return null;
}

/**
 * Возвращает действие INTERACT для открытия закрытой двери.
 */
function openDoorAction(actor: EnemyEntity, door: DoorEntity): InteractAction {
  return {
    type: 'INTERACT',
    entityId: actor.id,
    targetId: door.id,
  };
}

/**
 * Возвращает один шаг MOVE к указанной позиции по кратчайшему пути.
 *
 * Использует A* с диагональным движением. Закрытые двери на пути
 * считаются проходимыми: если следующий шаг приходится на закрытую дверь,
 * возвращается действие INTERACT вместо MOVE.
 *
 * Если путь не найден — возвращает 'blocked'.
 */
export function moveToward(
  actor: EnemyEntity,
  state: GameState,
  target: Position,
): MoveTowardResult {
  const path = findPath(
    { x: actor.x, y: actor.y },
    target,
    (pos) => isTilePassableForEnemy(state, pos),
    DEFAULT_PATHFINDING_LIMIT,
    DEFAULT_ALLOW_DIAGONAL,
  );

  if (!path || path.length === 0) {
    return { kind: 'blocked' };
  }

  const step = path[0]!;

  const door = findClosedDoorAt(state, step.x, step.y);
  if (door) {
    return {
      kind: 'interact',
      action: openDoorAction(actor, door),
    };
  }

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

  if (moveResult.kind === 'move' || moveResult.kind === 'interact') {
    return moveResult;
  }

  return { kind: 'blocked' };
}
