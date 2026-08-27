/**
 * Тактические утилиты для способностей ИИ.
 *
 * Ответственность:
 * - Выбор конкретных целей/клеток для способностей по критериям стратегии
 *   (например, точка приземления Налёта, дающая столкновение цели с препятствием).
 *
 * Правила:
 * - Функции чистые, детерминированы при одинаковом state.
 * - Не мутируют aiState и не эмитят событий.
 * - Не решают, стоит ли кастовать способность — только находят подходящую цель.
 */

import type {EnemyEntity, GameState, Position} from '@simulation/types';
import {findAllEntitiesAt, isActor, isTerrainWalkable} from '@simulation/state';
import {chebyshevDistance} from '@utils/math';
import {getSkillExecutor} from '@simulation/skills/skillExecutor';

/**
 * Проверяет, является ли клетка препятствием для столкновения при толчке:
 * за пределами карты, непроходимый террейн, живой актор или блокирующий объект.
 *
 * Семантика повторяет executePushIntent (collision.wall / actor / blocking-object).
 * excludeEntityId — сущность, которую не считать препятствием (кастер:
 * к моменту толчка он уже переместился прыжком в точку приземления).
 */
function isCollisionObstacle(state: GameState, pos: Position, excludeEntityId?: string): boolean {
  if (pos.x < 0 || pos.x >= state.map.width || pos.y < 0 || pos.y >= state.map.height) {
    return true;
  }
  if (!isTerrainWalkable(state.map.tiles[pos.y]?.[pos.x])) {
    return true;
  }
  const entities = findAllEntitiesAt(state, pos.x, pos.y).filter(e => e.id !== excludeEntityId);
  return entities.some(e => (isActor(e) && 'hp' in e && e.isAlive) || e.blocksMovement);
}

/**
 * Ищет точку применения способности (например, приземление Налёта), при которой
 * толчок цели от этой точки заканчивается столкновением с препятствием
 * (стена, блокирующий объект, другой актор) — такое столкновение даёт урон
 * и dazed глобальными правилами collision_damage / collision_daze.
 *
 * Критерии для кандидата из getValidTargets исполнителя:
 * - цель попадает в зону действия способности (getAffectedPositions);
 * - направление толчка sign(target − landing) ненулевое;
 * - клетка за целью по направлению толчка — препятствие.
 *
 * Итерация детерминирована: кандидаты сортируются по расстоянию до цели,
 * затем по x, затем по y. Возвращает null, если подходящей точки нет
 * или исполнитель способности не зарегистрирован.
 */
export function findCollisionLanding(
  state: GameState,
  caster: EnemyEntity,
  abilityId: string,
  target: Position,
): Position | null {
  const executor = getSkillExecutor(abilityId);
  if (!executor) {
    return null;
  }

  const landings = [...executor.getValidTargets(state, caster)].sort((a, b) => {
    const distDiff = chebyshevDistance(a, target) - chebyshevDistance(b, target);
    if (distDiff !== 0) return distDiff;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  for (const landing of landings) {
    // Клетка с живым актором — подставка: толчка и столкновения не будет,
    // а кастер может ударить союзника — такую точку не выбираем.
    if (findAllEntitiesAt(state, landing.x, landing.y).some(e => isActor(e) && 'hp' in e && e.isAlive)) {
      continue;
    }

    // Цель должна попадать в зону действия способности при выборе этой точки.
    const affected = executor.getAffectedPositions(state, caster, [landing], landing);
    if (!affected.some(p => p.x === target.x && p.y === target.y)) {
      continue;
    }

    // Направление толчка — от точки приземления через цель
    // (как в resolve исполнителя: sign(entity − landing) по каждой оси).
    const pushDx = Math.sign(target.x - landing.x);
    const pushDy = Math.sign(target.y - landing.y);
    if (pushDx === 0 && pushDy === 0) {
      continue;
    }

    const collisionCell = {x: target.x + pushDx, y: target.y + pushDy};
    if (isCollisionObstacle(state, collisionCell, caster.id)) {
      return landing;
    }
  }

  return null;
}
