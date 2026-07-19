/**
 * Исполнитель интента SPAWN_ITEM.
 *
 * Создаёт экземпляр предмета на карте, добавляет его в state.entities
 * и порождает событие ITEM_DROPPED.
 */

import type {GameState} from "@simulation/types.ts";
import type {IntentExecutor, SpawnItemIntent} from "@simulation/systems/intents/types.ts";
import type {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {findFreeTileNear} from "@simulation/systems/loot-spawn.ts";
import {tryGetItem} from "@content/registry";
import {createFloorItemContainer} from "@simulation/systems/item-entity-factory.ts";
import {createInventoryItem} from "@simulation/systems/inventory-factory.ts";

export const executeSpawnItemIntent: IntentExecutor<SpawnItemIntent> = (
    state: GameState,
    intent: SpawnItemIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const template = tryGetItem(intent.templateId);
    if (!template) return null;

    const spawnPos = findFreeTileNear(state, intent.position);

    const inventoryItem = createInventoryItem(state, intent.templateId);
    const container = createFloorItemContainer(state, inventoryItem, spawnPos);

    state.entities.set(container.id, container);

    const event = {
        type: 'ITEM_DROPPED' as const,
        dropperEntityId: intent.sourceEntityId,
        itemInstanceId: inventoryItem.instanceId,
        containerId: container.id,
        templateId: intent.templateId,
        position: { x: container.x, y: container.y },
        from: { x: intent.position.x, y: intent.position.y },
    };

    return builder.addChild(parent, event);
};
