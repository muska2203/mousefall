/**
 * Исполнитель интента EQUIP_ITEM.
 *
 * Устанавливает equipped{X}Id и equipped{X}InstanceId для указанного слота.
 */

import {GameState} from "@simulation/types.ts";
import {EquipItemIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {tryGetModifier} from "@content/registry";
import {addModifier} from "@simulation/systems/stats/modifier-engine.ts";
import {recalculateActorStats} from "@simulation/systems/stats/recalculate.ts";
import {addActiveRulesForItem, collectAffixRules} from "@simulation/systems/rules/active-rule-lifecycle.ts";

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

  // Stat-аффиксы экземпляра (фирменные + случайные) применяются движком модификаторов
  // (снятие — общий removeModifiersBySource при UNEQUIP_ITEM).
  for (const affix of item.affixes ?? []) {
    const modifier = tryGetModifier(affix.modifierId);
    if (!modifier || modifier.effect.kind !== 'stat') continue;
    addModifier(player, {
      stat: modifier.effect.stat,
      value: affix.value ?? 0,
      op: modifier.effect.op,
      source: `item_${item.instanceId}`,
    });
  }

  recalculateActorStats(player);

  // Правила rule-аффиксов экземпляра (фирменных — без значения, случайных — с ролленным).
  const affixRules = collectAffixRules(item.affixes ?? []);
  addActiveRulesForItem(player, item.instanceId, affixRules.ruleIds, affixRules.paramValues);

  return builder.addChild(parent, {
    type: 'ITEM_EQUIPPED', isFieldEvent: false,
    entityId: intent.entityId,
    itemInstanceId: intent.itemInstanceId,
    slot: intent.slot,
  });
};
