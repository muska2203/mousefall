/**
 * Исполнитель интента HEAL.
 *
 * Увеличивает HP цели на указанную величину, не превышая maxHp.
 * Порождает событие ENTITY_HEALED.
 */

import { GameState } from "@simulation/types.ts";
import { HealIntent, IntentExecutor } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { findEntity } from "@simulation/state.ts";

export const executeHealIntent: IntentExecutor<HealIntent> = (
  state: GameState,
  intent: HealIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findEntity(state, intent.entityId);
  if (!target || !('hp' in target) || !('maxHp' in target)) return null;

  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + intent.amount);
  const healed = target.hp - before;

  if (healed <= 0) return null;

  return builder.addChild(parent, {
    type: 'ENTITY_HEALED',
    entityId: intent.entityId,
    amount: healed,
    newHp: target.hp,
    position: { x: target.x, y: target.y },
  });
};
