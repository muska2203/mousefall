import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";


export function runActionHandler<T extends GameAction>(
  state: GameState,
  handler: ActionHandler<T>,
  action: T,
  executionBuilder: ExecutionBuilder,
  parentNode: ExecutionNode,
): void {

  const validation = handler.validate(state, action);

  if (!validation.ok) {
    return;
  }

  const intents = handler.resolve(state, action);

  handler.execute(
    state,
    action,
    intents,
    executionBuilder,
    parentNode,
  );
}