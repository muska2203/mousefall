/**
 * Конструкторы игровых действий (Presentation Layer).
 *
 * Собирают объекты GameAction из параметров UI-сессии, не содержат
 * игровой логики: валидация и применение — на стороне Simulation.
 */

import type {EntityId, GameAction, Position} from '@simulation/types';

/**
 * Позиционная базовая атака по клетке цели.
 *
 * dx/dy в позиционной форме симуляцией игнорируются (валидация идёт по
 * targetPosition), но планировщик анимаций строит выпад по ним —
 * проставляем знаковое направление на цель.
 */
export function buildPositionalAttackAction(
  playerId: EntityId,
  playerPos: Position,
  targetPos: Position,
): GameAction {
  return {
    type: 'ATTACK',
    entityId: playerId,
    dx: Math.sign(targetPos.x - playerPos.x),
    dy: Math.sign(targetPos.y - playerPos.y),
    targetPosition: { x: targetPos.x, y: targetPos.y },
  };
}
