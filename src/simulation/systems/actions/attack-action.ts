import {findAttacker, findFirstAttackableEntityAt, isEntityConcealedFrom} from "@simulation/state.ts";
import {GameState} from "@simulation/types.ts";
import {Position} from "@simulation/core-types.ts";
import {executeIntents} from "@simulation/systems/intents/execute-intent.ts";
import {ActionHandler, AttackAction, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";
import {rollWeaponDamage} from "@simulation/systems/stats/weapon-damage-roll.ts";
import {getWeaponAttackLosRadius, getWeaponAttackRange, isInWeaponRange} from "@simulation/systems/stats/weapon-range.ts";
import {getPrimaryDamageTag, getWeaponTags} from "@simulation/systems/tags/weapon-tags.ts";
import {mergeDamageIntentTags} from "@simulation/systems/tags/tag-helpers.ts";
import {computeFOV} from "@simulation/systems/fov.ts";
import {chebyshevDistance} from "@utils/math.ts";

// ─────────────────────────────────────────────
// Контекст атаки (устраняет дублирование поиска)
// ─────────────────────────────────────────────

type AttackFailureReason =
  | 'attacker_missing'
  | 'no_target'
  | 'target_out_of_range'
  | 'target_too_close'
  | 'too_close_for_ranged_weapon'
  | 'no_line_of_sight';

type AttackContext =
  | { ok: false; reason: AttackFailureReason }
  | {
      ok: true;
      attacker: NonNullable<ReturnType<typeof findAttacker>>;
      target: NonNullable<ReturnType<typeof findFirstAttackableEntityAt>>;
    };

/** Позиционная форма: атака конкретной клетки с проверкой дальности и LOS. */
function resolvePositionalAttackContext(
  state: GameState,
  attacker: NonNullable<ReturnType<typeof findAttacker>>,
  targetPosition: Position,
): AttackContext {
  const target = findFirstAttackableEntityAt(state, targetPosition.x, targetPosition.y);
  if (!target) {
    return { ok: false, reason: 'no_target' };
  }

  const attackRange = getWeaponAttackRange(attacker);
  // Общий предикат дальности: чебышёвская дистанция ∈ [minRange, range].
  if (!isInWeaponRange(attackRange, attacker, targetPosition)) {
    const distance = chebyshevDistance(attacker, targetPosition);
    return distance > attackRange.range
      ? { ok: false, reason: 'target_out_of_range' }
      : { ok: false, reason: 'target_too_close' };
  }

  // LOS: клетка цели должна быть видна из позиции атакующего (тот же FOV, что у игры).
  const visible = computeFOV(state, attacker.x, attacker.y, getWeaponAttackLosRadius(attackRange));
  const hasLos = visible.some(pos => pos.x === targetPosition.x && pos.y === targetPosition.y);
  if (!hasLos) {
    return { ok: false, reason: 'no_line_of_sight' };
  }

  // Сокрытие: цель на concealing-клетке (мука и т.п.) видна только с дистанции ≤ 1.
  if (isEntityConcealedFrom(state, targetPosition, attacker)) {
    return { ok: false, reason: 'no_line_of_sight' };
  }

  return { ok: true, attacker, target };
}

/**
 * Направленная форма (legacy bump-атака): бьёт соседнюю клетку (включая диагонали).
 * Дальнобойное оружие (minRange > 1) в упор не бьёт вообще: bump отклоняется
 * с отдельным reason-кодом, деградации в безоружный удар нет.
 */
function resolveDirectionalAttackContext(
  state: GameState,
  attacker: NonNullable<ReturnType<typeof findAttacker>>,
  action: AttackAction,
): AttackContext {
  const targetX = attacker.x + action.dx;
  const targetY = attacker.y + action.dy;
  const target = findFirstAttackableEntityAt(state, targetX, targetY);
  if (!target) {
    return { ok: false, reason: 'no_target' };
  }

  if (getWeaponAttackRange(attacker).minRange > 1) {
    return { ok: false, reason: 'too_close_for_ranged_weapon' };
  }

  return { ok: true, attacker, target };
}

function resolveAttackContext(state: GameState, action: AttackAction): AttackContext {
  const attacker = findAttacker(state, action.entityId);
  if (!attacker) {
    return { ok: false, reason: 'attacker_missing' };
  }

  if (action.targetPosition) {
    return resolvePositionalAttackContext(state, attacker, action.targetPosition);
  }
  return resolveDirectionalAttackContext(state, attacker, action);
}

// ─────────────────────────────────────────────
// Action handler
// ─────────────────────────────────────────────

export const attackEntity: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'ATTACK') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }
    const ctx = resolveAttackContext(state, action);
    if (!ctx.ok) {
      switch (ctx.reason) {
        case 'attacker_missing':
          return { ok: false, reasonCode: 'entity_not_exists' };
        case 'target_out_of_range':
          return { ok: false, reasonCode: 'target_out_of_range' };
        case 'target_too_close':
          return { ok: false, reasonCode: 'target_too_close' };
        case 'too_close_for_ranged_weapon':
          return { ok: false, reasonCode: 'too_close_for_ranged_weapon' };
        case 'no_line_of_sight':
          return { ok: false, reasonCode: 'no_line_of_sight' };
        default:
          return { ok: false, reasonCode: 'no_target_at_tile' };
      }
    }
    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'ATTACK') {
      return [];
    }
    const ctx = resolveAttackContext(state, action);
    if (!ctx.ok) {
      return [];
    }

    const damage = rollWeaponDamage(state, ctx.attacker);
    const primaryTag = getPrimaryDamageTag(ctx.attacker);
    const tags = mergeDamageIntentTags([primaryTag], getWeaponTags(ctx.attacker));

    const intents: Intent[] = [{
      type: 'DAMAGE' as const,
      entityId: ctx.target.id,
      sourceEntityId: ctx.attacker.id,
      damage,
      tags,
    }];

    return intents;
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    executeIntents(state, intents, executionBuilder, parentNode);
  },
};
