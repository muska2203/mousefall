import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export const waitEntity: ActionHandler = {

    validate(state: GameState, action) {
        if (action.type !== 'WAIT') {
            return {ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected WAIT action'};
        }
        return {ok: true};
    },

    resolve(state: GameState, action) {
        if (action.type !== 'WAIT') {
            return [];
        }
        return [];
    },

    execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {

    }
};
