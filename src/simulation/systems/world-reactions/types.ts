import {GameEvent, GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";

export type WorldReaction<T extends GameEvent> = (
    state: GameState,
    event: T,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => void;
