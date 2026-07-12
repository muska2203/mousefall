/**
 * Исполнитель интента UNEQUIP_ITEM.
 *
 * Сбрасывает equipped{X}Id и equipped{X}InstanceId для указанного слота в null.
 */

import { GameState } from "@simulation/types.ts";
import { IntentExecutor, UnequipItemIntent } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { removeModifiersBySource } from "@simulation/systems/stats/modifier-engine.ts";
import { recalculateActorStats } from "@simulation/systems/stats/recalculate.ts";
import { removeActiveRulesForItem } from "@simulation/systems/rules/active-rule-lifecycle.ts";

export const executeUnequipItemIntent: IntentExecutor<UnequipItemIntent> = (
  state: GameState,
  intent: UnequipItemIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const player = state.entities.get(intent.entityId);
  if (!player || player.type !== 'player') return null;

  const itemInstanceId = intent.slot === 'weapon' ? player.equippedWeaponInstanceId
    : intent.slot === 'armor' ? player.equippedArmorInstanceId
    : player.equippedAmuletInstanceId;

  if (!itemInstanceId) return null;

  if (intent.slot === 'weapon') {
    player.equippedWeaponId = null;
    player.equippedWeaponInstanceId = null;
  } else if (intent.slot === 'armor') {
    player.equippedArmorId = null;
    player.equippedArmorInstanceId = null;
  } else {
    player.equippedAmuletId = null;
    player.equippedAmuletInstanceId = null;
  }

  removeModifiersBySource(player, `item_${itemInstanceId}`);
  removeActiveRulesForItem(player, itemInstanceId);
  recalculateActorStats(player);

  return builder.addChild(parent, {
    type: 'ITEM_UNEQUIPPED',
    entityId: intent.entityId,
    itemInstanceId,
    slot: intent.slot,
  });
};
