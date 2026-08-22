/**
 * Обработчик действия UNEQUIP — снятие экипированного предмета.
 *
 * Логика:
 * - Проверяет, что указанный слот занят.
 * - Порождает UNEQUIP_ITEM и REVOKE_ABILITY.
 * - Особый случай слота weapon: «безоружную» атаку (unarmed) снять нельзя,
 *   а после снятия обычного оружия она экипируется автоматически —
 *   слот оружия у персонажа никогда не пустует.
 */

import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";
import {executeIntents} from "@simulation/systems/intents/execute-intent.ts";
import {createInventoryItem} from "@simulation/systems/inventory-factory.ts";

export const unequipEntity: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'UNEQUIP') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }

    const player = state.player;
    const equippedId = action.slot === 'weapon' ? player.equippedWeaponInstanceId
      : action.slot === 'armor' ? player.equippedArmorInstanceId
      : player.equippedAmuletInstanceId;
    if (!equippedId) {
      return { ok: false, reasonCode: 'slot_empty' };
    }

    // «Безоружная» атака — оружие по умолчанию, её нельзя снять.
    if (action.slot === 'weapon') {
      const equippedItem = player.inventory.find(i => i.instanceId === equippedId);
      if (equippedItem?.templateId === 'unarmed') {
        return { ok: false, reasonCode: 'cannot_unequip_unarmed' };
      }
    }

    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'UNEQUIP') {
      return [];
    }

    const player = state.player;
    const equippedId = action.slot === 'weapon' ? player.equippedWeaponInstanceId
      : action.slot === 'armor' ? player.equippedArmorInstanceId
      : player.equippedAmuletInstanceId;

    const item = player.inventory.find(i => i.instanceId === equippedId);

    const intents: Intent[] = [
      { type: 'UNEQUIP_ITEM', entityId: action.entityId, slot: action.slot },
    ];

    if (item && item.grantedAbilities.length > 0) {
      intents.push({ type: 'REVOKE_ABILITY', entityId: action.entityId, sourceItemInstanceId: equippedId! });
    }

    return intents;
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    executeIntents(state, intents, executionBuilder, parentNode);

    // После снятия оружия автоматически экипируем «безоружную» атаку,
    // чтобы слот оружия не пустовал.
    if (action.type === 'UNEQUIP' && action.slot === 'weapon'
        && state.player.equippedWeaponInstanceId === null) {
      const unarmedItem = createInventoryItem(state, 'unarmed');
      state.player.inventory.push(unarmedItem);
      executeIntents(state, [
        {
          type: 'EQUIP_ITEM',
          entityId: action.entityId,
          itemInstanceId: unarmedItem.instanceId,
          slot: 'weapon',
        },
      ], executionBuilder, parentNode);
    }
  },
};
