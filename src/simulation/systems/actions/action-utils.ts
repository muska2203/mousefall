import {GameState, ValidationResult} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";


export function runActionHandler(
  state: GameState,
  handler: ActionHandler,
  action: GameAction,
  executionBuilder: ExecutionBuilder,
  parentNode: ExecutionNode,
): ValidationResult {

  const validation = handler.validate(state, action);

  if (!validation.ok) {
    return validation;
  }

  const intents = handler.resolve(state, action);

  handler.execute(
    state,
    action,
    intents,
    executionBuilder,
    parentNode,
  );

  return { ok: true };
}
