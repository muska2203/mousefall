/**
 * Исполнитель интента PICK_UP.
 *
 * Добавляет предмет в инвентарь игрока, удаляет его с пола
 * и порождает событие ITEM_PICKED_UP.
 *
 * Исполнитель работает только для сущности игрока (`type === 'player'`).
 */

import type { GameState } from "@simulation/types.ts";
import type { PickUpIntent, IntentExecutor } from "@simulation/systems/intents/types.ts";
import type { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import type { FloorItemContainerEntity, PlayerEntity } from "@simulation/types.ts";

export const executePickUpIntent: IntentExecutor<PickUpIntent> = (
    state: GameState,
    intent: PickUpIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const entity = state.entities.get(intent.itemId);
    if (!entity || entity.type !== 'floor_item_container') {
        return null;
    }

    const actor = state.entities.get(intent.entityId);
    if (!actor || actor.type !== 'player') {
        return null;
    }

    const player = actor;
    const itemEntity = entity.item;

    player.inventory.push(itemEntity);

    state.entities.delete(entity.id);
    state.runStats.itemsPickedUp += itemEntity.quantity;

    return builder.addChild(parent, {
        type: 'ITEM_PICKED_UP' as const,
        entityId: intent.entityId,
        itemInstanceId: itemEntity.instanceId,
        templateId: itemEntity.templateId,
    });
};
