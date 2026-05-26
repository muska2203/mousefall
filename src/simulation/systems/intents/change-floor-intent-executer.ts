import {GameState} from "@simulation/types.ts";
import {ChangeFloorIntent, ExecutionBuilder, ExecutionNode} from "@simulation/core-types.ts";
import {performFloorTransition} from "@simulation/systems/actions/floor-transition-logic.ts";
import {IntentExecutor} from "@simulation/systems/intents/types.ts";

export const executeChangeFloorIntent: IntentExecutor<ChangeFloorIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const from = state.floor;
  const result = performFloorTransition(state, intent.direction);
  const node = builder.addChild(parent, {
    type: 'FLOOR_CHANGED',
    from,
    to: result.to,
  });
  for (const fovEvent of result.fovEvents) {
    builder.addChild(parent, fovEvent);
  }
  return node;
};
