/**
 * Стратегия "простой босс".
 *
 * Поведение:
 * - Босс не перемещается и не использует обычную атаку.
 * - Если видит игрока, пытается подготовить одну из доступных
 *   preparable способностей к выполнению в следующий ход.
 * - Если подготовленное намерение уже есть — ждёт.
 *
 * Стратегия опирается на контент (флаг aiPreparable в шаблоне способности),
 * поэтому не привязана к конкретному скиллу.
 */

import { registerStrategy } from './strategy-registry';
import type { AiActor, GameState } from '@simulation/types';
import type { GameAction, ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { canSeePlayer, tryPrepareAbility, endTurn } from './ai-helpers';
import { isEnemyEntity } from './ai-state';

registerStrategy('simple-boss', {
  updateState() {
    // У simple-boss нет конечного автомата — состояние не меняется.
  },

  decideAction(actor, state, builder, parent) {
    if (!isEnemyEntity(actor)) {
      return endTurn(actor);
    }
    const enemy = actor;

    // Приоритет 1: выполнить подготовленную способность.
    if (enemy.aiState.preparedAbility) {
      return {
        type: 'USE_ABILITY',
        entityId: enemy.id,
        abilityId: enemy.aiState.preparedAbility.abilityId,
        targets: enemy.aiState.preparedAbility.targets,
      };
    }

    // Приоритет 2: если видим игрока — готовим первую доступную preparable способность.
    // Подготовка — side-effect стратегии: она эмитит ABILITY_PREPARED
    // и завершает ход через END_TURN.
    if (canSeePlayer(enemy, state)) {
      if (tryPrepareAbility(enemy, state, builder, parent)) {
        return endTurn(enemy);
      }
    }

    // В остальных случаях босс завершает ход.
    return endTurn(enemy);
  },
});
