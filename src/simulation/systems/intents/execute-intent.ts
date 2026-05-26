import {GameState} from "@simulation/types.ts";
import {executeMoveIntent} from "@simulation/systems/intents/move-intent-executer.ts";
import {executeDamageIntent} from "@simulation/systems/intents/attack-intent-executer.ts";
import {Intent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {runWorldReactions} from "@simulation/systems/world-reactions/reactions.ts";
import {executeDieIntent} from "@simulation/systems/intents/die-intent-executer.ts";
import {executeApplyStatusIntent} from "@simulation/systems/intents/apply-status-intent-executer.ts";
import {executeChangeFloorIntent} from "@simulation/systems/intents/change-floor-intent-executer.ts";
import {executeConsumeMpIntent} from "@simulation/systems/intents/consume-mp-intent-executer.ts";
import {executeSetCooldownIntent} from "@simulation/systems/intents/set-cooldown-intent-executer.ts";
import {executeConsumeApIntent} from "@simulation/systems/intents/consume-ap-intent-executer.ts";
import {executeTickStatusEffectsIntent} from "@simulation/systems/intents/tick-status-effects-intent-executer.ts";


const intentExecutors = {
  MOVE: executeMoveIntent,
  DAMAGE: executeDamageIntent,
  DIE: executeDieIntent,
  APPLY_STATUS: executeApplyStatusIntent,
  CHANGE_FLOOR: executeChangeFloorIntent,
  CONSUME_MP: executeConsumeMpIntent,
  SET_COOLDOWN: executeSetCooldownIntent,
  CONSUME_AP: executeConsumeApIntent,
  TICK_STATUS_EFFECTS: executeTickStatusEffectsIntent,
};

export function executeIntent(
  state: GameState,
  intent: Intent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) {
    const executor = intentExecutors[intent.type] as IntentExecutor<any>;
    const resultNode = executor(
        state,
        intent,
        builder,
        parent,
    );
    if (resultNode !== null) {
        const reactionIntents = runWorldReactions(state, builder, resultNode);
        for (const reactionIntent of reactionIntents) {
            executeIntent(state, reactionIntent, builder, resultNode);
        }
    }
}






