/**
 * Стратегия "простой босс".
 *
 * Поведение:
 * - Босс не перемещается и не использует обычную атаку.
 * - Если видит игрока, пытается подготовить одну из доступных
 *   preparable способностей (PREPARE_ABILITY) к выполнению в следующий ход.
 * - Если подготовленное намерение уже есть — ждёт.
 *
 * Стратегия опирается на контент (флаг aiPreparable в шаблоне способности),
 * поэтому не привязана к конкретному скиллу.
 */

import { registerStrategy } from './strategy-registry';
import type { AiActor, GameState } from '@simulation/types';
import type { GameAction } from '@simulation/systems/actions/types';
import { canSeePlayer, tryPrepareAbility, wait } from './ai-helpers';
import { isEnemyEntity } from './ai-state';

registerStrategy('simple-boss', {
  updateState() {
    // У simple-boss нет конечного автомата — состояние не меняется.
  },

  decideAction(actor, state) {
    if (!isEnemyEntity(actor)) {
      return wait(actor);
    }
    const enemy = actor;

    // Приоритет 1: если есть подготовленное намерение — босс ждёт
    // его выполнения в начале следующего хода.
    if (enemy.aiState.preparedIntent) {
      return wait(enemy);
    }

    // Приоритет 2: если видим игрока — готовим первую доступную preparable способность.
    if (canSeePlayer(enemy, state)) {
      const prepareAction = tryPrepareAbility(enemy, state);
      if (prepareAction) {
        return prepareAction;
      }
    }

    // В остальных случаях босс стоит на месте.
    return wait(enemy);
  },
});
