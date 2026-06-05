/**
 * Исполнитель интента EQUIP_ITEM.
 *
 * Устанавливает equipped{X}Id и equipped{X}InstanceId для указанного слота.
 */

import { GameState } from "@simulation/types.ts";
import { IntentExecutor, EquipItemIntent } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { getItem } from "@content/registry";
import { addModifier } from "@simulation/systems/stats/modifier-engine.ts";
import { recalculateActorStats } from "@simulation/systems/stats/recalculate.ts";

export const executeEquipItemIntent: IntentExecutor<EquipItemIntent> = (
  state: GameState,
  intent: EquipItemIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const player = state.entities.get(intent.entityId);
  if (!player || player.type !== 'player') return null;

  const item = player.inventory.find(i => i.instanceId === intent.itemInstanceId);
  if (!item) return null;

  if (intent.slot === 'weapon') {
    player.equippedWeaponId = item.templateId;
    player.equippedWeaponInstanceId = item.instanceId;
  } else if (intent.slot === 'armor') {
    player.equippedArmorId = item.templateId;
    player.equippedArmorInstanceId = item.instanceId;
  } else {
    player.equippedAmuletId = item.templateId;
    player.equippedAmuletInstanceId = item.instanceId;
  }

  const template = getItem(item.templateId);
  for (const mod of template.equipModifiers ?? []) {
    addModifier(player, { ...mod, source: `item_${item.instanceId}` });
  }

  recalculateActorStats(player);

  return builder.addChild(parent, {
    type: 'ITEM_EQUIPPED',
    entityId: intent.entityId,
    itemInstanceId: intent.itemInstanceId,
    slot: intent.slot,
  });
};
