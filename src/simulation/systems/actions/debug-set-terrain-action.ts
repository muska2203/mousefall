/**
 * Обработчик debug-действия DEBUG_SET_TERRAIN.
 *
 * Меняет террейн выбранной клетки на указанный.
 * Доступно только при включённом debug-режиме.
 */

import {GameState} from '@simulation/types.ts';
import {tryGetTerrain} from '@content/registry';
import {ActionHandler, ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import {Intent} from '@simulation/systems/intents/types.ts';
import type {DebugContext} from './debug-add-item-action.ts';

export function createDebugSetTerrainActionHandler(context: DebugContext): ActionHandler {
  return {
    validate(state: GameState, action) {
      if (action.type !== 'DEBUG_SET_TERRAIN') {
        return { ok: false, reasonCode: 'wrong_action_type' };
      }

      if (!context.enabled) {
        return { ok: false, reasonCode: 'debug_disabled' };
      }

      if (action.entityId !== state.player.id) {
        return { ok: false, reasonCode: 'only_player_can_cheat' };
      }

      const { x, y } = action.position;
      if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
        return { ok: false, reasonCode: 'position_out_of_bounds' };
      }

      if (!tryGetTerrain(action.terrainId)) {
        return { ok: false, reasonCode: 'terrain_template_not_found' };
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
      if (action.type !== 'DEBUG_SET_TERRAIN') {
        return;
      }

      const { x, y } = action.position;
      state.map.tiles[y]![x] = action.terrainId;
    },
  };
}
