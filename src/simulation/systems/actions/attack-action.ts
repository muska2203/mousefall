import {findAttacker, findFirstAttackableEntityAt} from "@simulation/state.ts";
import {GameState} from "@simulation/types.ts";
import {executeIntents} from "@simulation/systems/intents/execute-intent.ts";
import {ActionHandler, AttackAction, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";
import { getEffectiveWeaponDamage } from "@simulation/systems/stats/effective-stats.ts";
import { getPrimaryDamageTag, getWeaponTags } from "@simulation/systems/tags/weapon-tags.ts";
import { mergeDamageIntentTags } from "@simulation/systems/tags/tag-helpers.ts";

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

    const damage = getEffectiveWeaponDamage(ctx.attacker);
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
