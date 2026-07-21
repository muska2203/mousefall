/**
 * Обработчик debug-действия DEBUG_SPAWN_TILE_EFFECT.
 *
 * Создаёт тайловый эффект на выбранной клетке.
 * Доступно только при включённом debug-режиме.
 */

import {GameState} from '@simulation/types.ts';
import {tryGetTileEffect} from '@content/registry';
import {ActionHandler, ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import {executeIntents} from '@simulation/systems/intents/execute-intent.ts';
import {Intent} from '@simulation/systems/intents/types.ts';
import type {DebugContext} from './debug-add-item-action.ts';

export function createDebugSpawnTileEffectActionHandler(context: DebugContext): ActionHandler {
  return {
    validate(state: GameState, action) {
      if (action.type !== 'DEBUG_SPAWN_TILE_EFFECT') {
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

      if (state.map.tiles[y]![x] !== 'floor') {
        return { ok: false, reasonCode: 'not_a_floor_tile' };
      }

      if (!tryGetTileEffect(action.effectType)) {
        return { ok: false, reasonCode: 'tile_effect_template_not_found' };
      }

      return { ok: true };
    },

    resolve(state: GameState, action): Intent[] {
      if (action.type !== 'DEBUG_SPAWN_TILE_EFFECT') return [];
      return [{
        type: 'SPAWN_TILE_EFFECT',
        effectType: action.effectType,
        position: action.position,
      }];
    },

    execute(
      state: GameState,
      _action,
      intents: Intent[],
      executionBuilder: ExecutionBuilder,
      parentNode: ExecutionNode,
    ) {
      // Реальное изменение состояния выполняет исполнитель SPAWN_TILE_EFFECT.
      executeIntents(state, intents, executionBuilder, parentNode);
    },
  };
}
