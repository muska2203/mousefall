import {GameState} from "@simulation/types.ts";
import {ConsumeApIntent, ExecutionBuilder, ExecutionNode} from "@simulation/core-types.ts";
import {IntentExecutor} from "@simulation/systems/intents/types.ts";

export const executeConsumeApIntent: IntentExecutor<ConsumeApIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || !('ap' in actor)) return null;

  const before = actor.ap;
  actor.ap = Math.max(0, actor.ap - intent.amount);

  return builder.addChild(parent, {
    type: 'RESOURCE_CONSUMED',
    entityId: intent.entityId,
    resource: 'ap',
    amount: before - actor.ap,
    remaining: actor.ap,
  });
};
