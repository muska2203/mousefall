import {GameState} from "@simulation/types.ts";
import {executeMoveIntent} from "@simulation/systems/intents/move-intent-executer.ts";
import {executeJumpIntent} from "@simulation/systems/intents/jump-intent-executor.ts";

import {executePushIntent} from "@simulation/systems/intents/push-intent-executer.ts";
import {executeDamageIntent} from "@simulation/systems/intents/attack-intent-executer.ts";
import {Intent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {runWorldReactions} from "@simulation/systems/world-reactions/reactions.ts";
import {executeDieIntent} from "@simulation/systems/intents/die-intent-executer.ts";
import {executeApplyStatusIntent} from "@simulation/systems/intents/apply-status-intent-executer.ts";
import {executeSetMapIntent} from "@simulation/systems/intents/set-map-intent-executor.ts";
import {executeSetEntitiesIntent} from "@simulation/systems/intents/set-entities-intent-executor.ts";
import {executeTeleportEntityIntent} from "@simulation/systems/intents/teleport-entity-intent-executor.ts";
import {executeUpdateFogIntent} from "@simulation/systems/intents/update-fog-intent-executor.ts";
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
import {executeHealIntent} from "@simulation/systems/intents/heal-intent-executer.ts";
import {executeRemoveItemIntent} from "@simulation/systems/intents/remove-item-intent-executer.ts";
import {executeOpenDoorIntent, executeCloseDoorIntent} from "@simulation/systems/intents/door-intent-executor.ts";
import {executeFloorTransitionIntent} from "@simulation/systems/intents/floor-transition-intent-executor.ts";
import {executeBumpIntent} from "@simulation/systems/intents/bump-intent-executor.ts";
import {executeSkipStunnedTurnIntent} from "@simulation/systems/intents/skip-stunned-turn-intent-executor.ts";
import {executeRestoreApIntent} from "@simulation/systems/intents/restore-ap-intent-executer.ts";
import {executeTickCooldownIntent} from "@simulation/systems/intents/tick-cooldown-intent-executer.ts";
import {executeBeginTurnIntent} from "@simulation/systems/intents/begin-turn-intent-executer.ts";
import {executeCleanupDeadEntitiesIntent} from "@simulation/systems/intents/cleanup-dead-entities-intent-executor.ts";
import {executeApplyFogEventsIntent} from "@simulation/systems/intents/apply-fog-events-intent-executor.ts";
import {executeNotifyAIIntent} from "@simulation/systems/intents/notify-ai-intent-executor.ts";
import {executeCounterAttackIntent} from "@simulation/systems/intents/counter-attack-intent-executor.ts";
import {buildRuleContext} from "@simulation/content-rules/rule-context.ts";
import {applyIntentModifiersIfEnabled} from "@simulation/content-rules/intent-modifiers.ts";
import {runContentRuleReactionsIfEnabled} from "@simulation/content-rules/event-reactions.ts";
import { resolveStatusBatch } from "@simulation/systems/statuses/status-conflict-resolver.ts";

const intentExecutors = {
  MOVE: executeMoveIntent,
  JUMP: executeJumpIntent,
  PUSH: executePushIntent,
  DAMAGE: executeDamageIntent,
  DIE: executeDieIntent,
  APPLY_STATUS: executeApplyStatusIntent,
  SET_MAP: executeSetMapIntent,
  SET_ENTITIES: executeSetEntitiesIntent,
  TELEPORT_ENTITY: executeTeleportEntityIntent,
  UPDATE_FOG: executeUpdateFogIntent,
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
  HEAL: executeHealIntent,
  REMOVE_ITEM: executeRemoveItemIntent,
  OPEN_DOOR: executeOpenDoorIntent,
  CLOSE_DOOR: executeCloseDoorIntent,
  FLOOR_TRANSITION: executeFloorTransitionIntent,
  BUMP: executeBumpIntent,
  SKIP_STUNNED_TURN: executeSkipStunnedTurnIntent,
  RESTORE_AP: executeRestoreApIntent,
  TICK_COOLDOWN: executeTickCooldownIntent,
  BEGIN_TURN: executeBeginTurnIntent,
  CLEANUP_DEAD_ENTITIES: executeCleanupDeadEntitiesIntent,
  APPLY_FOG_EVENTS: executeApplyFogEventsIntent,
  NOTIFY_AI: executeNotifyAIIntent,
  COUNTER_ATTACK: executeCounterAttackIntent,
};

/** Максимальное количество реакций в одной цепочке защиты от бесконечного цикла. */
const MAX_REACTION_DEPTH = 1000;

/**
 * Исполняет пачку интентов, предварительно разрешая конфликты статусов.
 */
export function executeIntents(
    state: GameState,
    intents: Intent[],
    builder: ExecutionBuilder,
    parent: ExecutionNode,
): void {
    const resolved = resolveStatusBatch(state, intents);
    for (const intent of resolved) {
        executeIntent(state, intent, builder, parent, 0);
    }
}

export function executeIntent(
    state: GameState,
    intent: Intent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
    reactionDepth: number = 0,
): ExecutionNode | null {
    if (reactionDepth > MAX_REACTION_DEPTH) {
        // eslint-disable-next-line no-console
        console.error('[executeIntent] превышен лимит глубины реакций (%d)', MAX_REACTION_DEPTH);
        return null;
    }

    const intentContext = buildRuleContext(state, intent);
    const modifiedIntent = applyIntentModifiersIfEnabled(state, intent, intentContext);

    const executor = intentExecutors[modifiedIntent.type] as IntentExecutor<any>;
    const resultNode = executor(
        state,
        modifiedIntent,
        builder,
        parent,
    );

    if (resultNode !== null) {
        const contentReactionIntents = runContentRuleReactionsIfEnabled(state, resultNode.event, builder, resultNode);
        for (const reactionIntent of resolveStatusBatch(state, contentReactionIntents)) {
            executeIntent(state, reactionIntent, builder, resultNode, reactionDepth + 1);
        }

        const reactionIntents = runWorldReactions(state, builder, resultNode);
        for (const reactionIntent of resolveStatusBatch(state, reactionIntents)) {
            executeIntent(state, reactionIntent, builder, resultNode, reactionDepth + 1);
        }
    }
    return resultNode;
}
