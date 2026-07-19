/**
 * Обработчик debug-действия DEBUG_ADD_ITEM.
 *
 * Добавляет произвольный предмет в инвентарь игрока.
 * Доступно только при включённом debug-режиме.
 */

import {GameState} from '@simulation/types.ts';
import {tryGetItem} from '@content/registry';
import {createInventoryItem} from '@simulation/systems/inventory-factory.ts';
import {ActionHandler, ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import {Intent} from '@simulation/systems/intents/types.ts';

export type DebugContext = {
  enabled: boolean;
};

export function createDebugAddItemActionHandler(context: DebugContext): ActionHandler {
  return {
    validate(state: GameState, action) {
      if (action.type !== 'DEBUG_ADD_ITEM') {
        return { ok: false, reasonCode: 'wrong_action_type' };
      }

      if (!context.enabled) {
        return { ok: false, reasonCode: 'debug_disabled' };
      }

      if (action.entityId !== state.player.id) {
        return { ok: false, reasonCode: 'only_player_can_cheat' };
      }

      if (!tryGetItem(action.templateId)) {
        return { ok: false, reasonCode: 'item_template_not_found' };
      }

      return { ok: true };
    },

    resolve(): Intent[] {
      return [];
    },

    execute(
      state: GameState,
      action,
      _intents: Intent[],
      _executionBuilder: ExecutionBuilder,
      _parentNode: ExecutionNode,
    ) {
      if (action.type !== 'DEBUG_ADD_ITEM') {
        return;
      }

      const item = createInventoryItem(state, action.templateId);
      state.player.inventory.push(item);
    },
  };
}
