import {findAttacker, findFirstAttackableEntityAt, isCombatEntity} from "@simulation/state.ts";
import {GameState, StatusEffect} from "@simulation/types.ts";
import {executeIntent} from "@simulation/systems/intents/execute-intent.ts";
import {ActionHandler, AttackAction, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";
import { getEffectiveDamageEntries } from "@simulation/systems/stats/effective-stats.ts";

// ─────────────────────────────────────────────
// Контекст атаки (устраняет дублирование поиска)
// ─────────────────────────────────────────────

type AttackContext =
  | { ok: false; reason: 'attacker_missing' }
  | { ok: false; reason: 'no_target' }
  | { ok: true; attacker: NonNullable<ReturnType<typeof findAttacker>>; target: NonNullable<ReturnType<typeof findFirstAttackableEntityAt>> };

function resolveAttackContext(state: GameState, action: AttackAction): AttackContext {
  const attacker = findAttacker(state, action.entityId);
  if (!attacker) {
    return { ok: false, reason: 'attacker_missing' };
  }

  const targetX = attacker.x + action.dx;
  const targetY = attacker.y + action.dy;
  const target = findFirstAttackableEntityAt(state, targetX, targetY);
  if (!target) {
    return { ok: false, reason: 'no_target' };
  }

  return { ok: true, attacker, target };
}

/**
 * Проверяет, есть ли у боевой сущности активный статус контратаки
 * с положительным количеством стаков.
 */
function hasCounterattack(entity: { statusEffects: StatusEffect[] }): boolean {
  const effect = entity.statusEffects.find(e => e.type === 'counterattack');
  if (!effect) return false;
  return (effect.stacks ?? 1) > 0;
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
      if (ctx.reason === 'attacker_missing') {
        return { ok: false, reasonCode: 'entity_not_exists' };
      }
      return { ok: false, reasonCode: 'no_target_at_tile' };
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

    // Если у цели есть контратака — блокируем входящий урон и контратакуем.
    if (isCombatEntity(ctx.target) && hasCounterattack(ctx.target)) {
      const counterattackIntents: Intent[] = [
        {
          type: 'ADJUST_STATUS_STACKS',
          entityId: ctx.target.id,
          statusType: 'counterattack',
          delta: -1,
        },
      ];

      for (const entry of getEffectiveDamageEntries(ctx.target)) {
        counterattackIntents.push({
          type: 'DAMAGE',
          entityId: ctx.attacker.id,
          sourceEntityId: ctx.target.id,
          damage: entry.damage,
          damageType: entry.damageType,
        });
      }

      return counterattackIntents;
    }

    return getEffectiveDamageEntries(ctx.attacker).map(entry => ({
      type: 'DAMAGE' as const,
      entityId: ctx.target.id,
      sourceEntityId: ctx.attacker.id,
      damage: entry.damage,
      damageType: entry.damageType,
    }));
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
