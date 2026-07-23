import {GameState} from "@simulation/types.ts";
import {executeMoveIntent} from "@simulation/systems/intents/move-intent-executer.ts";
import {executeJumpIntent} from "@simulation/systems/intents/jump-intent-executor.ts";

import {executePushIntent} from "@simulation/systems/intents/push-intent-executer.ts";
import {executeDamageIntent} from "@simulation/systems/intents/attack-intent-executer.ts";
import {executeDamageTileIntent} from "@simulation/systems/intents/damage-tile-intent-executor.ts";
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
import {executeCloseDoorIntent, executeOpenDoorIntent} from "@simulation/systems/intents/door-intent-executor.ts";
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
import {
  executeApplyTileEffectStatusIntent,
  executeRemoveTileEffectIntent,
  executeRemoveTileEffectStatusIntent,
  executeSpawnTileEffectIntent,
  executeTickTileEffectsIntent,
} from "@simulation/systems/intents/tile-effect-intent-executor.ts";
import {executeTileExplosionIntent} from "@simulation/systems/intents/tile-explosion-intent-executor.ts";
import {buildRuleContext} from "@simulation/content-rules/rule-context.ts";
import {applyIntentModifiersIfEnabled} from "@simulation/content-rules/intent-modifiers.ts";
import {runContentRuleReactionsIfEnabled} from "@simulation/content-rules/event-reactions.ts";
import {resolveStatusBatch} from "@simulation/systems/statuses/status-conflict-resolver.ts";

const intentExecutors = {
  MOVE: executeMoveIntent,
  JUMP: executeJumpIntent,
  PUSH: executePushIntent,
  DAMAGE: executeDamageIntent,
  DAMAGE_TILE: executeDamageTileIntent,
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
  SPAWN_TILE_EFFECT: executeSpawnTileEffectIntent,
  REMOVE_TILE_EFFECT: executeRemoveTileEffectIntent,
  TICK_TILE_EFFECTS: executeTickTileEffectsIntent,
  APPLY_TILE_EFFECT_STATUS: executeApplyTileEffectStatusIntent,
  REMOVE_TILE_EFFECT_STATUS: executeRemoveTileEffectStatusIntent,
  TILE_EXPLOSION: executeTileExplosionIntent,
};

/** Максимальное количество волн реакций защиты от бесконечного цикла. */
const MAX_REACTION_DEPTH = 1000;

/** Очередной интент вместе с родительским узлом, к которому он привязывается. */
type PendingIntent = {
  intent: Intent;
  parent: ExecutionNode;
};

/**
 * Исполняет пачку интентов волнами: сначала все интенты текущей волны,
 * затем реакции на все порождённые события образуют следующую волну.
 *
 * Внутри одной волны сохраняется порядок: сначала полностью разрешаются
 * контентные реакции, потом мировые реакции. Это гарантирует, что массовые
 * эффекты (например, взрыв горящего масла) применяются параллельно ко всем
 * целям, а не последовательно змейкой.
 */
export function executeIntents(
    state: GameState,
    intents: Intent[],
    builder: ExecutionBuilder,
    parent: ExecutionNode,
): (ExecutionNode | null)[] {
    let wave: PendingIntent[] = intents.map((intent) => ({ intent, parent }));
    let depth = 0;
    let topLevelResults: (ExecutionNode | null)[] | null = null;

    while (wave.length > 0) {
        if (depth > MAX_REACTION_DEPTH) {
            // eslint-disable-next-line no-console
            console.error('[executeIntents] превышен лимит глубины реакций (%d)', MAX_REACTION_DEPTH);
            break;
        }

        const { resultNodes, createdNodes } = executeIntentBatch(state, builder, wave);
        if (topLevelResults === null) {
            topLevelResults = resultNodes;
        }

        // Сначала полностью разрешаем контентные реакции на события волны,
        // затем собираем мировые реакции уже с учётом результатов контентной фазы.
        const { nodes: contentNodes, limitReached } = runContentPhase(state, builder, createdNodes, depth);
        if (limitReached) {
            break;
        }
        const worldIntents = collectWorldReactionIntents(state, builder, [...createdNodes, ...contentNodes]);

        wave = worldIntents;
        depth++;
    }

    return topLevelResults ?? [];
}

/**
 * Исполняет один интент. Обёртка над executeIntents для обратной совместимости.
 * Параметр reactionDepth сохранён в сигнатуре, но больше не используется:
 * глубина отсчитывается от корня вызова executeIntents.
 */
export function executeIntent(
    state: GameState,
    intent: Intent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
    _reactionDepth: number = 0,
): ExecutionNode | null {
    const results = executeIntents(state, [intent], builder, parent);
    return results[0] ?? null;
}

/**
 * Исполняет пачку интентов, не запуская реакции.
 * Возвращает узлы результатов для каждого интента и все созданные событийные узлы.
 */
function executeIntentBatch(
    state: GameState,
    builder: ExecutionBuilder,
    intents: PendingIntent[],
): { resultNodes: (ExecutionNode | null)[]; createdNodes: ExecutionNode[] } {
    const resultNodes: (ExecutionNode | null)[] = [];
    const createdNodes: ExecutionNode[] = [];

    for (const { intent, parent } of intents) {
        const intentContext = buildRuleContext(state, intent);
        const modifiedIntent = applyIntentModifiersIfEnabled(state, intent, intentContext);

        // Запоминаем количество дочерних узлов до исполнения, чтобы отделить
        // события, порождённые этим интентом, от уже существующих детей.
        const childrenBefore = parent.children.length;

        const executor = intentExecutors[modifiedIntent.type] as IntentExecutor<any>;
        const resultNode = executor(
            state,
            modifiedIntent,
            builder,
            parent,
        );

        resultNodes.push(resultNode);

        if (resultNode !== null) {
            const newChildren = parent.children.slice(childrenBefore);
            const nodesToProcess = newChildren.length > 0 ? newChildren : [resultNode];
            createdNodes.push(...nodesToProcess);
        }
    }

    return { resultNodes, createdNodes };
}

/**
 * Полностью разрешает контентные реакции на переданных узлах, включая
 * цепочки контент-реакций на результаты контент-реакций.
 * Все интенты одного уровня исполняются параллельно (batch).
 *
 * Возвращает созданные узлы и флаг `limitReached`, чтобы вызывающий цикл
 * прервал дальнейшее исполнение при превышении лимита глубины.
 */
function runContentPhase(
    state: GameState,
    builder: ExecutionBuilder,
    seedNodes: ExecutionNode[],
    startDepth: number,
): { nodes: ExecutionNode[]; limitReached: boolean } {
    const allContentNodes: ExecutionNode[] = [];
    let currentNodes = seedNodes;
    let depth = startDepth;

    while (currentNodes.length > 0) {
        if (depth >= MAX_REACTION_DEPTH) {
            // eslint-disable-next-line no-console
            console.error('[executeIntents] превышен лимит глубины реакций (%d)', MAX_REACTION_DEPTH);
            return { nodes: allContentNodes, limitReached: true };
        }

        const contentIntents: PendingIntent[] = [];
        for (const node of currentNodes) {
            const nodeIntents = runContentRuleReactionsIfEnabled(state, node.event, builder, node);
            const resolved = resolveStatusBatch(state, nodeIntents);
            for (const intent of resolved) {
                contentIntents.push({ intent, parent: node });
            }
        }

        if (contentIntents.length === 0) {
            break;
        }

        const { createdNodes } = executeIntentBatch(state, builder, contentIntents);
        allContentNodes.push(...createdNodes);
        currentNodes = createdNodes;
        depth++;
    }

    return { nodes: allContentNodes, limitReached: false };
}

/**
 * Собирает интенты мировых реакций на переданных узлах.
 */
function collectWorldReactionIntents(
    state: GameState,
    builder: ExecutionBuilder,
    nodes: ExecutionNode[],
): PendingIntent[] {
    const worldIntents: PendingIntent[] = [];

    for (const node of nodes) {
        const nodeIntents = runWorldReactions(state, builder, node);
        const resolved = resolveStatusBatch(state, nodeIntents);
        for (const intent of resolved) {
            worldIntents.push({ intent, parent: node });
        }
    }

    return worldIntents;
}
