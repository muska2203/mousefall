import {GameState} from "@simulation/types.ts";
import {executeMoveIntent} from "@simulation/systems/intents/move-intent-executer.ts";
import {executePushIntent} from "@simulation/systems/intents/push-intent-executer.ts";
import {executeDamageIntent} from "@simulation/systems/intents/attack-intent-executer.ts";
import {Intent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {runWorldReactions} from "@simulation/systems/world-reactions/reactions.ts";
import {executeDieIntent} from "@simulation/systems/intents/die-intent-executer.ts";
import {executeApplyStatusIntent} from "@simulation/systems/intents/apply-status-intent-executer.ts";
import {executeChangeFloorIntent} from "@simulation/systems/intents/change-floor-intent-executer.ts";
import {executeSetCooldownIntent} from "@simulation/systems/intents/set-cooldown-intent-executer.ts";
import {executeConsumeApIntent} from "@simulation/systems/intents/consume-ap-intent-executer.ts";
import {executeTickStatusEffectsIntent} from "@simulation/systems/intents/tick-status-effects-intent-executer.ts";
import {executeAdjustStatusStacksIntent} from "@simulation/systems/intents/adjust-status-stacks-intent-executer.ts";
import {executeSpawnItemIntent} from "@simulation/systems/intents/spawn-item-intent-executor.ts";
import {executePickUpIntent} from "@simulation/systems/intents/pick-up-intent-executor.ts";
import {executeEquipItemIntent} from "@simulation/systems/intents/equip-item-intent-executor.ts";
import {executeUnequipItemIntent} from "@simulation/systems/intents/unequip-item-intent-executor.ts";
import {executeGrantAbilityIntent} from "@simulation/systems/intents/grant-ability-intent-executor.ts";
import {executeRevokeAbilityIntent} from "@simulation/systems/intents/revoke-ability-intent-executor.ts";
import {executeBeginCastIntent} from "@simulation/systems/intents/begin-cast-intent-executor.ts";
import {executeHealIntent} from "@simulation/systems/intents/heal-intent-executer.ts";
import {executeRemoveItemIntent} from "@simulation/systems/intents/remove-item-intent-executer.ts";
import {executeOpenDoorIntent, executeCloseDoorIntent} from "@simulation/systems/intents/door-intent-executor.ts";
import {executeBumpIntent} from "@simulation/systems/intents/bump-intent-executor.ts";

const intentExecutors = {
  MOVE: executeMoveIntent,
  PUSH: executePushIntent,
  DAMAGE: executeDamageIntent,
  DIE: executeDieIntent,
  APPLY_STATUS: executeApplyStatusIntent,
  CHANGE_FLOOR: executeChangeFloorIntent,
  SET_COOLDOWN: executeSetCooldownIntent,
  CONSUME_AP: executeConsumeApIntent,
  TICK_STATUS_EFFECTS: executeTickStatusEffectsIntent,
  ADJUST_STATUS_STACKS: executeAdjustStatusStacksIntent,
  SPAWN_ITEM: executeSpawnItemIntent,
  PICK_UP: executePickUpIntent,
  EQUIP_ITEM: executeEquipItemIntent,
  UNEQUIP_ITEM: executeUnequipItemIntent,
  GRANT_ABILITY: executeGrantAbilityIntent,
  REVOKE_ABILITY: executeRevokeAbilityIntent,
  BEGIN_CAST: executeBeginCastIntent,
  HEAL: executeHealIntent,
  REMOVE_ITEM: executeRemoveItemIntent,
  OPEN_DOOR: executeOpenDoorIntent,
  CLOSE_DOOR: executeCloseDoorIntent,
  BUMP: executeBumpIntent,
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






