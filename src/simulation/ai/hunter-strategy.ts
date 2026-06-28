/**
 * Стратегия "охотник" с конечным автоматом из 4 состояний.
 *
 * Состояния:
 * - idle:    стоит на месте, сканирует окружение
 * - alert:   1 ход на осмотр при обнаружении игрока, запоминает его позицию
 * - chase:   движется к последней известной позиции игрока, атакует вблизи
 * - return:  возвращается к точке спавна (home), если игрок потерян
 *
 * Переходы:
 *   idle ──[увидел игрока]──→ alert ──[1 ход]──→ chase
 *     ↑                                            │
 *     │          [потерял + дошёл до target]       │
 *     │                                            ▼
 *   return ◄───────────────────────────────────── chase
 *     │
 *     └──[дошёл home]──→ idle
 *
 * В любой момент: [увидел игрока] из idle/return/alert ──→ chase
 */

import { registerStrategy } from './strategy-registry';
import type { AiActor, EnemyEntity, GameState } from '@simulation/types';
import { canSeePlayer, tryCastAbility, tryPrepareAbility, tryAttackOrMoveToward, wait } from './ai-helpers';
import { isEnemyEntity, getAIOverlay } from './ai-state';

registerStrategy('hunter', {
  updateState(actor, state) {
    if (!isEnemyEntity(actor)) return;
    updateHunterState(actor, state);
  },

  decideAction(actor, state) {
    if (!isEnemyEntity(actor)) {
      return wait(actor);
    }
    const enemy = actor;

    // Приоритет 1–2: временные overlay-состояния (stunned, casting, prepared)
    // требуют ожидания до их завершения.
    const overlay = getAIOverlay(enemy);
    if (overlay) {
      return wait(enemy);
    }

    // Приоритет 3: подготовить скилл к выполнению в следующий ход
    // Подготовка может прервать текущие действия, если враг видит игрока
    if (canSeePlayer(enemy, state)) {
      const prepareAction = tryPrepareAbility(enemy, state);
      if (prepareAction) {
        return prepareAction;
      }
    }

    // Приоритет 4: начать кастование способности
    const castAction = tryCastAbility(enemy, state);
    if (castAction) {
      return castAction;
    }

    switch (enemy.aiState.mode) {
      case 'idle': {
        return wait(enemy);
      }

      case 'alert': {
        // В режиме ALERT враг тратит ход на "осмотр" (WAIT).
        // Переход в chase произойдёт при следующем вызове updateHunterState.
        return wait(enemy);
      }

      case 'chase': {
        const tx = enemy.aiState.targetX;
        const ty = enemy.aiState.targetY;

        // Защита: если target вдруг null, переключаемся в return
        if (tx === null || ty === null) {
          enemy.aiState.mode = 'return';
          return wait(enemy);
        }

        return tryAttackOrMoveToward(enemy, state, tx, ty);
      }

      case 'return': {
        return tryAttackOrMoveToward(enemy, state, enemy.aiState.homeX, enemy.aiState.homeY);
      }
    }
  },
});

/**
 * Обновляет состояние конечного автомата врага.
 * Мутирует только enemy.aiState — никакие другие части state не трогаются.
 */
function updateHunterState(enemy: EnemyEntity, state: GameState): void {
  // Пока активно временное overlay-состояние, FSM не меняется.
  if (getAIOverlay(enemy)) return;

  const seesPlayer = canSeePlayer(enemy, state);
  const player = state.player;

  switch (enemy.aiState.mode) {
    case 'idle': {
      if (seesPlayer) {
        enemy.aiState.mode = 'alert';
        enemy.aiState.alertTurns = 1;
        enemy.aiState.targetX = player.x;
        enemy.aiState.targetY = player.y;
      }
      break;
    }

    case 'alert': {
      enemy.aiState.alertTurns -= 1;
      if (enemy.aiState.alertTurns <= 0) {
        enemy.aiState.mode = 'chase';
      }
      break;
    }

    case 'chase': {
      if (seesPlayer) {
        // Обновляем target на актуальную позицию игрока
        enemy.aiState.targetX = player.x;
        enemy.aiState.targetY = player.y;
      } else if (
        enemy.aiState.targetX !== null &&
        enemy.aiState.targetY !== null &&
        enemy.x === enemy.aiState.targetX &&
        enemy.y === enemy.aiState.targetY
      ) {
        // Дошли до последней известной позиции, игрока нет — возвращаемся домой
        enemy.aiState.mode = 'return';
        enemy.aiState.targetX = null;
        enemy.aiState.targetY = null;
      }
      break;
    }

    case 'return': {
      if (seesPlayer) {
        enemy.aiState.mode = 'chase';
        enemy.aiState.targetX = player.x;
        enemy.aiState.targetY = player.y;
      } else if (enemy.x === enemy.aiState.homeX && enemy.y === enemy.aiState.homeY) {
        enemy.aiState.mode = 'idle';
      }
      break;
    }
  }
}
