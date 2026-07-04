/**
 * Стратегия "охотник".
 *
 * Поведение:
 * - Ищет атакуемую цель в пределах видимости (сейчас — только игрок).
 * - Если цель видна — сразу движется к ней вплотную по кратчайшему маршруту и атакует.
 * - Если цель потеряна во время погони — идёт к последней известной позиции,
 *   затем возвращается к точке спавна.
 *
 * Архитектура:
 * - Стратегия отвечает за порядок приоритетов и FSM-переходы.
 * - Конкретные действия (MOVE/ATTACK, поиск пути) делегируются
 *   тактическому реестру {@link './tactics'}.
 */

import { registerStrategy } from './strategy-registry';
import type { AiActor, EnemyEntity, GameState, Position } from '@simulation/types';
import type { GameAction } from '@simulation/systems/actions/types';
import type { WorldChange } from './perception-types';
import { wait, canSeePlayer, canSeePosition } from './ai-helpers';
import { isEnemyEntity } from './ai-state';
import { findVisibleAttackTarget, closeCombat, moveToward } from './tactics';

registerStrategy('hunter', {
  updateState(actor, state) {
    if (!isEnemyEntity(actor)) return;
    updateHunterState(actor, state);
  },

  onWorldChange(actor, state, change) {
    if (!isEnemyEntity(actor)) return;
    handleHunterWorldChange(actor, state, change);
  },

  decideAction(actor, state, _builder, _parent) {
    if (!isEnemyEntity(actor)) {
      return wait(actor);
    }

    const enemy = actor;

    // Приоритет 1: если видим цель — сразу идём к ней вплотную и атакуем.
    const visibleTarget = findVisibleAttackTarget(enemy, state);
    if (visibleTarget) {
      const result = closeCombat(enemy, state, visibleTarget);
      if (result.kind !== 'blocked') {
        return result.action;
      }
      return wait(enemy);
    }

    // Приоритет 2: действуем согласно текущему FSM-режиму.
    switch (enemy.aiState.mode) {
      case 'idle': {
        return wait(enemy);
      }

      case 'chase': {
        const tx = enemy.aiState.targetX;
        const ty = enemy.aiState.targetY;

        if (tx === null || ty === null) {
          // Защита: target потерян — переключаемся в return.
          enemy.aiState.mode = 'return';
          return wait(enemy);
        }

        // targetX/Y — последняя известная позиция цели, а не сама цель.
        // Нужно обязательно встать на эту клетку, чтобы FSM смог перейти
        // в return, а не пытаться атаковать пустую клетку рядом с ней.
        const result = moveToward(enemy, state, { x: tx, y: ty });
        if (result.kind === 'move') {
          return result.action;
        }
        return wait(enemy);
      }

      case 'return': {
        const home: Position = { x: enemy.aiState.homeX, y: enemy.aiState.homeY };
        const result = moveToward(enemy, state, home);
        if (result.kind === 'move') {
          return result.action;
        }
        return wait(enemy);
      }
    }
  },
});

/**
 * Обрабатывает изменение мира, замеченное охотником.
 *
 * Стратегия сама проверяет видимость, так как только она знает,
 * какие объекты для неё значимы.
 */
function handleHunterWorldChange(enemy: EnemyEntity, state: GameState, change: WorldChange): void {
  switch (change.kind) {
    case 'entity_moved': {
      // Охотник реагирует только на игрока.
      if (change.entityId !== state.player.id) return;

      if (canSeePosition(enemy, state, change.to)) {
        engagePlayer(enemy, change.to);
      }
      break;
    }

    case 'door_opened':
    case 'door_closed': {
      // Реагируем только если игрок стал виден (или всё ещё виден)
      // в результате изменения двери.
      if (canSeePlayer(enemy, state)) {
        engagePlayer(enemy, state.player);
      }
      break;
    }
  }
}

/**
 * Обновляет состояние конечного автомата охотника.
 *
 * Мутирует только `enemy.aiState` — никакие другие части state не трогаются.
 */
function updateHunterState(enemy: EnemyEntity, state: GameState): void {
  const seesPlayer = canSeePlayer(enemy, state);

  switch (enemy.aiState.mode) {
    case 'idle': {
      if (seesPlayer) {
        engagePlayer(enemy, state.player);
      }
      break;
    }

    case 'chase': {
      if (seesPlayer) {
        // Обновляем target на актуальную позицию игрока.
        updateChaseTarget(enemy, state.player);
      } else if (
        enemy.aiState.targetX !== null &&
        enemy.aiState.targetY !== null &&
        enemy.x === enemy.aiState.targetX &&
        enemy.y === enemy.aiState.targetY
      ) {
        // Дошли до последней известной позиции, цели нет — возвращаемся домой.
        enemy.aiState.mode = 'return';
        enemy.aiState.targetX = null;
        enemy.aiState.targetY = null;
      }
      break;
    }

    case 'return': {
      if (seesPlayer) {
        engagePlayer(enemy, state.player);
      } else if (enemy.x === enemy.aiState.homeX && enemy.y === enemy.aiState.homeY) {
        enemy.aiState.mode = 'idle';
      }
      break;
    }
  }
}

/**
 * Переводит охотника в режим погони на указанную позицию.
 * Используется единообразно в onWorldChange и updateHunterState.
 */
function engagePlayer(enemy: EnemyEntity, target: Position): void {
  enemy.aiState.mode = 'chase';
  updateChaseTarget(enemy, target);
}

/**
 * Обновляет цель погони, не меняя режим.
 */
function updateChaseTarget(enemy: EnemyEntity, target: Position): void {
  enemy.aiState.targetX = target.x;
  enemy.aiState.targetY = target.y;
}
