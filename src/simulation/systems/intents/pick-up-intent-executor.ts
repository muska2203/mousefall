/**
 * Исполнитель интента PICK_UP.
 *
 * Добавляет предмет в инвентарь игрока, удаляет его с пола
 * и порождает событие ITEM_PICKED_UP.
 */

import type { GameState } from "@simulation/types.ts";
import type { PickUpIntent, IntentExecutor } from "@simulation/systems/intents/types.ts";
import type { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import type { ItemEntity, PlayerEntity } from "@simulation/types.ts";

export const executePickUpIntent: IntentExecutor<PickUpIntent> = (
    state: GameState,
    intent: PickUpIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const item = state.entities.get(intent.itemId);
    if (!item || item.type !== 'item') {
        return null;
    }

    const actor = state.entities.get(intent.entityId);
    if (!actor || actor.type !== 'player') {
        return null;
    }

    const player = actor as PlayerEntity;
    const itemEntity = item as ItemEntity;

    player.inventory.push({
        instanceId: itemEntity.id,
        templateId: itemEntity.templateId,
        quantity: itemEntity.quantity,
    });

    state.entities.delete(itemEntity.id);

    return builder.addChild(parent, {
        type: 'ITEM_PICKED_UP' as const,
        entityId: intent.entityId,
        itemInstanceId: itemEntity.id,
        templateId: itemEntity.templateId,
    });
};
