/**
 * Обработчик действия UNEQUIP — снятие экипированного предмета.
 *
 * Логика:
 * - Проверяет, что указанный слот занят.
 * - Порождает UNEQUIP_ITEM и REVOKE_ABILITY.
 */

import { GameState } from "@simulation/types.ts";
import { ActionHandler, ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { Intent } from "@simulation/systems/intents/types.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";

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
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
