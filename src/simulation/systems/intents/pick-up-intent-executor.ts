/**
 * Исполнитель интента PICK_UP.
 *
 * Добавляет предмет в инвентарь игрока, удаляет его с пола
 * и порождает событие ITEM_PICKED_UP.
 *
 * Стакаемые предметы (шаблон с `stackable: true`) сливаются в первый неполный
 * стек того же `templateId` (до `maxStack`); не влезший остаток кладётся новой
 * ячейкой инвентаря. Разделение стопок и частичный перенос — этап 2.3.
 *
 * Исполнитель работает только для сущности игрока (`type === 'player'`).
 */

import type {GameState} from "@simulation/types.ts";
import type {IntentExecutor, PickUpIntent} from "@simulation/systems/intents/types.ts";
import type {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {addItemToInventory} from "@simulation/systems/inventory-factory.ts";

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
    const pickedQuantity = itemEntity.quantity;

    // Слияние стопок до maxStack выполняет общий хелпер;
    // остаток (весь предмет для нестакаемых) он же кладёт новой ячейкой.
    addItemToInventory(player, itemEntity);

    state.entities.delete(entity.id);
    state.runStats.itemsPickedUp += pickedQuantity;

    return builder.addChild(parent, {
        type: 'ITEM_PICKED_UP', isFieldEvent: true as const,
        entityId: intent.entityId,
        itemInstanceId: itemEntity.instanceId,
        templateId: itemEntity.templateId,
    });
};
