import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, WaitAction} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export const waitEntity: ActionHandler<WaitAction> = {

    validate(state: GameState, action: WaitAction) {
        return {ok: true};
    },
    
    resolve(state: GameState, action: WaitAction) {
        return [];
    },
    
    execute(state: GameState, action: WaitAction, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {

    }
};