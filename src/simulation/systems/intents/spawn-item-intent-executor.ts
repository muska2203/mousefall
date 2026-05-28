/**
 * Исполнитель интента SPAWN_ITEM.
 *
 * Создаёт экземпляр предмета на карте, добавляет его в state.entities
 * и порождает событие ITEM_DROPPED.
 */

import type { GameState } from "@simulation/types.ts";
import type { SpawnItemIntent, IntentExecutor } from "@simulation/systems/intents/types.ts";
import type { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { nextEntityId } from "@simulation/state.ts";
import { findFreeTileNear } from "@simulation/systems/loot-spawn.ts";
import { tryGetItem } from "@content/registry";
import type { ItemEntity } from "@simulation/types.ts";
import { rollItemAbility } from "@simulation/systems/item-ability-roll.ts";

export const executeSpawnItemIntent: IntentExecutor<SpawnItemIntent> = (
    state: GameState,
    intent: SpawnItemIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const template = tryGetItem(intent.templateId);
    if (!template) return null;

    const spawnPos = findFreeTileNear(state, intent.position);

    const item: ItemEntity = {
        id: nextEntityId(state, 'item'),
        type: 'item',
        templateId: intent.templateId,
        x: spawnPos.x,
        y: spawnPos.y,
        blocksMovement: false,
        displayName: template.name,
        quantity: 1,
        grantedAbility: rollItemAbility(template, state.rng),
    };

    state.entities.set(item.id, item);

    const event = {
        type: 'ITEM_DROPPED' as const,
        dropperEntityId: intent.sourceEntityId,
        itemInstanceId: item.id,
        templateId: intent.templateId,
        position: { x: item.x, y: item.y },
        from: { x: intent.position.x, y: intent.position.y },
    };

    return builder.addChild(parent, event);
};
