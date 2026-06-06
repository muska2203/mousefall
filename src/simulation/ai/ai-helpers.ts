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
import { isBlocked } from '@simulation/state';
import { chebyshevDistance, findPath } from '@utils/math';
import { computeFOV } from '@simulation/systems/fov';
import { getCastableAbilities } from './cast-helpers';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';

// ─────────────────────────────────────────────
// Зрение
// ─────────────────────────────────────────────

/**
 * Проверяет, видит ли враг игрока.
 * Использует тот же алгоритм recursive shadowcasting, что и игрок,
 * с радиусом обзора врага (aiSightRadius).
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 */
export function canSeePlayer(enemy: EnemyEntity, state: GameState): boolean {
  const visible = computeFOV(state, enemy.x, enemy.y, enemy.aiSightRadius);
  const player = state.player;
  return visible.some((pos) => pos.x === player.x && pos.y === player.y);
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
 * Иначе делает шаг к цели через A* (findPath).
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

  const path = findPath(
    { x: enemy.x, y: enemy.y },
    { x: targetX, y: targetY },
    (pos) => !isBlocked(state, pos.x, pos.y),
    200,
    true // разрешаем диагональное движение
  );

  if (path && path.length > 0) {
    const step = path[0]!;
    const sdx = step.x - enemy.x;
    const sdy = step.y - enemy.y;
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
