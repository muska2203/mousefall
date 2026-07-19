/**
 * Утилиты валидации целей способностей.
 *
 * Используются action handler'ами, чтобы не дублировать логику проверки
 * валидных клеток и количества целей для разных режимов таргетинга.
 */

import type {Entity, GameState, Position, ValidationResult} from '@simulation/types';
import {getSkillExecutor} from './skillExecutor';

/**
 * Проверяет, что выбранные цели способности корректны:
 * - executor существует,
 * - каждая цель входит в список валидных клеток,
 * - количество целей соответствует режиму таргетинга (single / multi).
 */
export function validateAbilityTargets(
  state: GameState,
  caster: Entity,
  abilityId: string,
  targets: Position[],
): ValidationResult {
  const executor = getSkillExecutor(abilityId);
  if (!executor) {
    return { ok: false, reasonCode: 'executor_not_found' };
  }

  const validTargets = executor.getValidTargets(state, caster);
  for (const target of targets) {
    if (!positionInList(target, validTargets)) {
      return { ok: false, reasonCode: 'invalid_target' };
    }
  }

  const targetMode = executor.getTargetMode(state, caster);
  if (targetMode.type === 'single' && targets.length !== 1) {
    return { ok: false, reasonCode: 'wrong_target_count' };
  }
  if (targetMode.type === 'multi' && targets.length !== targetMode.count) {
    return { ok: false, reasonCode: 'wrong_target_count' };
  }

  return { ok: true };
}

function positionInList(pos: Position, list: Position[]): boolean {
  return list.some((p) => p.x === pos.x && p.y === pos.y);
}
