/**
 * Чистые утилиты для ИИ-стратегий.
 *
 * Ответственность:
 * - Проверка зрения (радиус + LOS).
 * - Управление подготовленными способностями (prepare / cancel).
 * - Хелперы для генерации GameAction (endTurn).
 *
 * Правила:
 * - Никаких побочных эффектов, кроме мутации actor.aiState (часть GameState).
 * - Все функции детерминированы при одинаковом state.
 *
 * Примечание:
 * - Логика передвижения и ближнего боя вынесена в тактический реестр
 *   {@link ./tactics}, чтобы стратегии могли переиспользовать её
 *   без дублирования.
 */

import type { GameAction, ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import type { AiActor, EnemyEntity, GameState, Position } from '@simulation/types';
import { computeFOV } from '@simulation/systems/fov';
import { chebyshevDistance } from '@utils/math';
import { getPreparableAbilities } from './cast-helpers';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';

// ─────────────────────────────────────────────
// Зрение
// ─────────────────────────────────────────────

/**
 * Проверяет, видит ли враг указанную позицию.
 * Использует тот же алгоритм recursive shadowcasting, что и игрок,
 * с радиусом обзора врага (aiSightRadius).
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 */
export function canSeePosition(
  enemy: EnemyEntity,
  state: GameState,
  position: Position,
): boolean {
  const visible = computeFOV(state, enemy.x, enemy.y, enemy.aiSightRadius);
  return visible.some((pos) => pos.x === position.x && pos.y === position.y);
}

/**
 * Проверяет, видит ли враг игрока.
 * Использует тот же алгоритм recursive shadowcasting, что и игрок,
 * с радиусом обзора врага (aiSightRadius).
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 */
export function canSeePlayer(enemy: EnemyEntity, state: GameState): boolean {
  return canSeePosition(enemy, state, state.player);
}

// ─────────────────────────────────────────────
// Каст способностей
// ─────────────────────────────────────────────

/**
 * Возвращает клетки из списка, отсортированные по расстоянию до игрока.
 * При равенстве расстояний сохраняется исходный порядок.
 */
export function sortByDistanceToPlayer(targets: Position[], player: Position): Position[] {
  return [...targets].sort((a, b) => {
    const distA = chebyshevDistance(a, player);
    const distB = chebyshevDistance(b, player);
    return distA - distB;
  });
}

/**
 * Проверяет, что выбранная клетка попадает в зону действия способности.
 * Используется для скиллов, целью которых является не сам игрок,
 * а клетка (например, прыжок или AoE-зона).
 */
export function canAffectPlayer(
  state: GameState,
  caster: EnemyEntity,
  executor: NonNullable<ReturnType<typeof getSkillExecutor>>,
  target: Position,
): boolean {
  const affected = executor.getAffectedPositions(state, caster, [target], target);
  const player = state.player;
  return affected.some((pos) => pos.x === player.x && pos.y === player.y);
}

/**
 * Выбирает цели для способности AI с приоритетом на игрока.
 * Для single-режима возвращает одну цель, для multi — до count целей.
 * Если игрок не является валидной целью (например, скилл приземляется в пустую клетку),
 * выбирается ближайшая к игроку клетка, зона действия которой достаёт до игрока.
 * Возвращает null, если executor не найден, нет валидных целей или
 * ни одна цель не может задеть игрока.
 */
export function chooseAbilityTargets(
  state: GameState,
  caster: EnemyEntity,
  abilityId: string,
): Position[] | null {
  const executor = getSkillExecutor(abilityId);
  if (!executor) {
    return null;
  }

  const targets = executor.getValidTargets(state, caster);
  if (targets.length === 0) {
    return null;
  }

  const player = state.player;
  const targetMode = executor.getTargetMode(state, caster);
  const targetWithPlayer = targets.find((t) => t.x === player.x && t.y === player.y);

  if (targetMode.type === 'multi') {
    // Мульти-таргетные скиллы (magic_slap) целятся в существа;
    // без игрока в списке целей смысла кастовать нет.
    if (!targetWithPlayer) {
      return null;
    }
    const count = targetMode.count;
    const rest = targets.filter(
      (t) => t.x !== targetWithPlayer.x || t.y !== targetWithPlayer.y,
    );
    const closestRest = sortByDistanceToPlayer(rest, player).slice(0, count - 1);
    return [targetWithPlayer, ...closestRest];
  }

  if (targetWithPlayer) {
    return [targetWithPlayer];
  }

  // Single-таргетные скиллы с пустыми клетками (прыжок, AoE-зона):
  // выбираем ближайшую к игроку клетку, зона которой задевает игрока.
  const candidates = sortByDistanceToPlayer(targets, player).filter((target) =>
    canAffectPlayer(state, caster, executor, target),
  );
  const best = candidates[0];
  return best ? [best] : null;
}

// ─────────────────────────────────────────────
// Подготовка скилла AI
// ─────────────────────────────────────────────

/**
 * Сбрасывает подготовленную способность AI и возвращает её данные.
 * Используется при оглушении или других отменах подготовки.
 */
export function cancelPreparedAbility(
  enemy: EnemyEntity,
): { abilityId: string; targets: Position[] } | null {
  const prepared = enemy.aiState.preparedAbility;
  if (!prepared) {
    return null;
  }
  enemy.aiState.preparedAbility = null;
  return prepared;
}

/**
 * Подготавливает скилл к выполнению в следующий ход.
 * Мутирует enemy.aiState.preparedAbility и эмитит событие ABILITY_PREPARED
 * как дочернее к parent через builder.
 */
export function prepareAbility(
  enemy: EnemyEntity,
  abilityId: string,
  targets: Position[],
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): void {
  enemy.aiState.preparedAbility = { abilityId, targets };

  builder.addChild(parent, {
    type: 'ABILITY_PREPARED',
    entityId: enemy.id,
    abilityId,
    targets,
    from: { x: enemy.x, y: enemy.y },
  });
}

/**
 * Пытается подготовить скилл к выполнению в следующий ход.
 * Возвращает true, если нашёлся подходящий preparable скилл с целью
 * и подготовка была произведена как side-effect.
 * Иначе false.
 */
export function tryPrepareAbility(
  enemy: EnemyEntity,
  state: GameState,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): boolean {
  const preparableAbilities = getPreparableAbilities(enemy, state);
  if (preparableAbilities.length === 0) {
    return false;
  }

  const ability = preparableAbilities[0]!;
  const chosenTargets = chooseAbilityTargets(state, enemy, ability.templateId);
  if (!chosenTargets || chosenTargets.length === 0) {
    return false;
  }

  prepareAbility(enemy, ability.templateId, chosenTargets, builder, parent);
  return true;
}

// ─────────────────────────────────────────────
// Утилиты для GameAction
// ─────────────────────────────────────────────

/** Возвращает END_TURN-действие для указанного AI-актора. */
export function endTurn(actor: AiActor): GameAction {
  return { type: 'END_TURN', entityId: actor.id };
}
