import {DieIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {PLAYER_ID} from "@utils/constants.ts";
import {removeEnemy} from "@simulation/state.ts";

export const executeDieIntent: IntentExecutor<DieIntent> = (
    state: GameState,
    intent: DieIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    if (intent.entityId === PLAYER_ID) {
        state.player.hp = 0;
        state.phase = 'dead';
        return builder.addChild(parent, {type: 'PLAYER_DIED'});
    } else {
        if (removeEnemy(state, intent.entityId)) {
            return builder.addChild(parent, {type: 'ENTITY_DIED', entityId: intent.entityId, position: intent.position})
        }
    }
    return null;
}