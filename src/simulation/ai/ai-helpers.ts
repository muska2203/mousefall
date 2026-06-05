/**
 * Чистые утилиты для ИИ-стратегий.
 *
 * Ответственность:
 * - Проверка зрения (радиус + LOS).
 * - Поиск пути к цели.
 * - Попытка каста способности.
 * - Хелперы для генерации GameAction.
 *
 * Правила:
 * - Никаких побочных эффектов, кроме мутации actor.aiState (часть GameState).
 * - Все функции детерминированы при одинаковом state.
 */

import type { GameAction } from '@simulation/systems/actions/types';
import type { EnemyEntity, GameState, Position } from '@simulation/types';
import { blocksLOS, isBlocked } from '@simulation/state';
import { manhattanDistance, chebyshevDistance, nextStepToward } from '@utils/math';
import { getCastableAbilities } from './cast-helpers';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';

// ─────────────────────────────────────────────
// Зрение
// ─────────────────────────────────────────────

/**
 * Проверяет, видит ли враг игрока.
 * Условия:
 * 1. Расстояние Манхэттена ≤ enemy.aiSightRadius
 * 2. Между врагом и игроком нет стен (line of sight)
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 */
export function canSeePlayer(enemy: EnemyEntity, state: GameState): boolean {
  const player = state.player;
  const dist = manhattanDistance(
    { x: enemy.x, y: enemy.y },
    { x: player.x, y: player.y }
  );

  if (dist > enemy.aiSightRadius) {
    return false;
  }

  return hasLineOfSight(state, enemy.x, enemy.y, player.x, player.y);
}

/**
 * Алгоритм Брезенхема для проверки линии видимости на сетке.
 * Возвращает true, если между (x0,y0) и (x1,y1) нет стен.
 * Целевая клетка не проверяется (игрок может стоять за стеной — это нормально).
 */
function hasLineOfSight(
  state: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x === x1 && y === y1) {
      return true;
    }

    // Проверяем клетку перед сдвигом, кроме стартовой
    if ((x !== x0 || y !== y0) && blocksLOS(state, x, y)) {
      return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// ─────────────────────────────────────────────
// Движение и атака
// ─────────────────────────────────────────────

/**
 * Возвращает true, если две позиции соседние по Чебышёву (в пределах 1 клетки, включая диагонали).
 */
export function isAdjacent(a: Position, b: Position): boolean {
  return chebyshevDistance(a, b) === 1;
}

/**
 * Пытается атаковать цель, если она рядом.
 * Иначе делает шаг к цели через BFS.
 * Если путь заблокирован — WAIT.
 */
export function tryAttackOrMoveToward(
  enemy: EnemyEntity,
  state: GameState,
  targetX: number,
  targetY: number
): GameAction {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = chebyshevDistance(
    { x: enemy.x, y: enemy.y },
    { x: targetX, y: targetY }
  );

  if (dist === 1) {
    return {
      type: 'ATTACK',
      entityId: enemy.id,
      dx: Math.sign(dx),
      dy: Math.sign(dy),
    };
  }

  const step = nextStepToward(
    { x: enemy.x, y: enemy.y },
    { x: targetX, y: targetY },
    (pos) => !isBlocked(state, pos.x, pos.y),
    20,
    true // разрешаем диагональное движение
  );

  if (step) {
    const sdx = step.x - enemy.x;
    const sdy = step.y - enemy.y;
    // Запрещаем резать угол между двумя стенами при диагональном движении
    if (Math.abs(sdx) === 1 && Math.abs(sdy) === 1) {
      if (isBlocked(state, enemy.x + sdx, enemy.y) && isBlocked(state, enemy.x, enemy.y + sdy)) {
        return wait(enemy);
      }
    }
    return {
      type: 'MOVE',
      entityId: enemy.id,
      dx: sdx,
      dy: sdy,
    };
  }

  return wait(enemy);
}

// ─────────────────────────────────────────────
// Каст способностей
// ─────────────────────────────────────────────

/**
 * Пытается начать кастование способности.
 * Возвращает USE_ABILITY, если нашлась подходящая способность с целью.
 * Иначе null.
 */
export function tryCastAbility(enemy: EnemyEntity, state: GameState): GameAction | null {
  const castAbilities = getCastableAbilities(enemy, state);
  if (castAbilities.length === 0) {
    return null;
  }

  const ability = castAbilities[0]!;
  const executor = getSkillExecutor(ability.templateId);
  const targets = executor ? executor.getValidTargets(state, enemy) : [];

  if (targets.length === 0) {
    return null;
  }

  const player = state.player;
  const targetWithPlayer = targets.find((t) => t.x === player.x && t.y === player.y);
  const chosenTarget = targetWithPlayer ?? targets[0];

  if (!chosenTarget) {
    return null;
  }

  return {
    type: 'USE_ABILITY',
    entityId: enemy.id,
    abilityId: ability.templateId,
    targets: [chosenTarget],
  };
}

// ─────────────────────────────────────────────
// Утилиты для GameAction
// ─────────────────────────────────────────────

/** Возвращает WAIT-действие для указанного актора. */
export function wait(enemy: EnemyEntity): GameAction {
  return { type: 'WAIT', entityId: enemy.id };
}
