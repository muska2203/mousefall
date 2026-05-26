import {GameState} from "@simulation/types.ts";
import {ConsumeMpIntent, ExecutionBuilder, ExecutionNode} from "@simulation/core-types.ts";
import {IntentExecutor} from "@simulation/systems/intents/types.ts";

export const executeConsumeMpIntent: IntentExecutor<ConsumeMpIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || !('mp' in actor)) return null;

  const before = actor.mp;
  actor.mp = Math.max(0, actor.mp - intent.amount);

  return builder.addChild(parent, {
    type: 'RESOURCE_CONSUMED',
    entityId: intent.entityId,
    resource: 'mp',
    amount: before - actor.mp,
    remaining: actor.mp,
  });
};
