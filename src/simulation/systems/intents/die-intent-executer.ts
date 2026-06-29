import {DieIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {PLAYER_ID} from "@utils/constants.ts";

export const executeDieIntent: IntentExecutor<DieIntent> = (
    state: GameState,
    intent: DieIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const entity = state.entities.get(intent.entityId);
    if (!entity) return null;

    if (intent.entityId === PLAYER_ID) {
        state.player.hp = 0;
        state.player.isAlive = false;
        state.phase = 'dead';
        return builder.addChild(parent, {type: 'PLAYER_DIED'});
    } else {
        if ('isAlive' in entity) {
            entity.isAlive = false;
            entity.blocksMovement = false;
            if ('aiState' in entity && entity.aiState) {
                entity.aiState.preparedIntent = null;
            }
            if (entity.type === 'enemy') {
                state.runStats.enemiesKilled++;
            }
            return builder.addChild(parent, {
                type: 'ENTITY_DIED',
                entityId: intent.entityId,
                position: intent.position,
            });
        }
    }
    return null;
}
