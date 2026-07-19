/**
 * Утилиты выбора цели для ИИ.
 *
 * Ответственность:
 * - Находить атакуемую цель в пределах видимости актора.
 *
 * Правила:
 * - Утилиты не решают, атаковать ли цель — только возвращают
 *   подходящую цель или null.
 * - Сейчас единственная возможная цель — игрок.
 *   В будущем здесь можно вернуть ближайшую атакуемую сущность
 *   независимо от типа.
 */

import type {EnemyEntity, GameState} from '@simulation/types';
import {canSeePlayer} from '../ai-helpers';
import type {AttackTarget} from './types';

/**
 * Возвращает видимую атакуемую цель для указанного врага.
 *
 * Сейчас всегда проверяет игрока. Если игрок виден и жив —
 * возвращает его как {@link AttackTarget}.
 * В будущем здесь можно расширить выбор: ближайший враг,
 * слабейшая цель, цель с наибольшей угрозой и т.д.
 */
export function findVisibleAttackTarget(
  actor: EnemyEntity,
  state: GameState,
): AttackTarget | null {
  if (canSeePlayer(actor, state) && state.player.isAlive) {
    return state.player;
  }

  return null;
}
