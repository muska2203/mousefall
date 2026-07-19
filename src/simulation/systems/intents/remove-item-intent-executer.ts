/**
 * Исполнитель интента REMOVE_ITEM.
 *
 * Уменьшает quantity предмета в инвентаре на 1.
 * Если quantity становится 0 — удаляет предмет из инвентаря.
 * Порождает событие ITEM_USED.
 */

import {GameState} from "@simulation/types.ts";
import {IntentExecutor, RemoveItemIntent} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";

export const executeRemoveItemIntent: IntentExecutor<RemoveItemIntent> = (
  state: GameState,
  intent: RemoveItemIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const player = state.entities.get(intent.entityId);
  if (!player || player.type !== 'player') return null;

  const index = player.inventory.findIndex(i => i.instanceId === intent.itemInstanceId);
  if (index === -1) return null;

  const item = player.inventory[index]!;
  item.quantity -= 1;

  if (item.quantity <= 0) {
    player.inventory.splice(index, 1);
  }

  return builder.addChild(parent, {
    type: 'ITEM_USED',
    entityId: intent.entityId,
    itemInstanceId: intent.itemInstanceId,
    templateId: intent.templateId,
  });
};
