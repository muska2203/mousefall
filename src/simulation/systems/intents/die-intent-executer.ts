import {DieIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {PLAYER_ID} from "@utils/constants.ts";
import {isBossTemplate} from "@simulation/systems/bossTracking.ts";

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
        return builder.addChild(parent, {type: 'PLAYER_DIED', isFieldEvent: false});
    } else {
        if ('isAlive' in entity) {
            entity.isAlive = false;
            entity.blocksMovement = false;
            if ('aiState' in entity && entity.aiState) {
                entity.aiState.preparedAbility = null;
            }
            if (entity.type === 'enemy') {
                state.runStats.enemiesKilled++;
                if ('templateId' in entity && isBossTemplate(entity.templateId)) {
                    if (!state.runStats.defeatedBossIds.includes(entity.templateId)) {
                        state.runStats.defeatedBossIds.push(entity.templateId);
                    }
                }
            }
            return builder.addChild(parent, {
                type: 'ENTITY_DIED', isFieldEvent: true,
                entityId: intent.entityId,
                position: intent.position,
            });
        }
    }
    return null;
}
