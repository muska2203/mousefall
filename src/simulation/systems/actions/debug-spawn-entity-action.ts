/**
 * Обработчик debug-действия DEBUG_SPAWN_ENTITY.
 *
 * Создаёт на карте произвольный игровой объект: предмет, врага, дверь или лестницу.
 * Доступно только при включённом debug-режиме.
 */

import { GameState } from '@simulation/types.ts';
import { tryGetItem, tryGetEntity, tryGetDoor, tryGetStairs } from '@content/registry';
import { findAllEntitiesAt } from '@simulation/state.ts';
import { createItemEntity } from '@simulation/systems/item-entity-factory.ts';
import { createEnemy, createDoor, createStairs } from '@simulation/systems/mapgen.ts';
import { ActionHandler, ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types.ts';
import { Intent } from '@simulation/systems/intents/types.ts';
import type { DebugContext } from './debug-add-item-action.ts';

export function createDebugSpawnEntityActionHandler(context: DebugContext): ActionHandler {
  return {
    validate(state: GameState, action) {
      if (action.type !== 'DEBUG_SPAWN_ENTITY') {
        return { ok: false, reasonCode: 'wrong_action_type' };
      }

      if (!context.enabled) {
        return { ok: false, reasonCode: 'debug_disabled' };
      }

      if (action.entityId !== state.player.id) {
        return { ok: false, reasonCode: 'only_player_can_cheat' };
      }

      const { x, y } = action.position;
      const { spawnType, templateId } = action;
      if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
        return { ok: false, reasonCode: 'position_out_of_bounds' };
      }

      if (state.map.tiles[y]![x] !== 'floor') {
        return { ok: false, reasonCode: 'not_a_floor_tile' };
      }

      const itemTemplate = tryGetItem(templateId);
      const entityTemplate = tryGetEntity(templateId);
      const doorTemplate = tryGetDoor(templateId);
      const stairsTemplate = tryGetStairs(templateId);

      const templateExists =
        (spawnType === 'item' && itemTemplate !== undefined) ||
        (spawnType === 'enemy' && entityTemplate !== undefined) ||
        (spawnType === 'door' && doorTemplate !== undefined) ||
        (spawnType === 'stairs' && stairsTemplate !== undefined);

      if (!templateExists) {
        return { ok: false, reasonCode: 'template_not_found' };
      }

      const entitiesHere = findAllEntitiesAt(state, x, y);

      // Врагов и двери нельзя ставить на любую занятую клетку (включая игрока).
      if ((spawnType === 'enemy' || spawnType === 'door') && entitiesHere.length > 0) {
        return { ok: false, reasonCode: 'tile_occupied' };
      }

      const hasObstacle = entitiesHere.some(e => e.blocksMovement && e.id !== state.player.id);
      if (hasObstacle) {
        return { ok: false, reasonCode: 'tile_blocked' };
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
      if (action.type !== 'DEBUG_SPAWN_ENTITY') {
        return;
      }

      const { x, y } = action.position;
      const { spawnType, templateId } = action;
      let entity;

      switch (spawnType) {
        case 'item':
          entity = createItemEntity(state, templateId, x, y);
          break;
        case 'enemy':
          entity = createEnemy(state, templateId, x, y);
          break;
        case 'door':
          entity = createDoor(state, templateId, x, y);
          break;
        case 'stairs': {
          // В реестре лестниц ожидаются только stairs_down / stairs_up.
          const direction = templateId === 'stairs_up' ? 'stairs_up' : 'stairs_down';
          entity = createStairs(state, direction, x, y);
          break;
        }
        default:
          return;
      }

      state.entities.set(entity.id, entity);
    },
  };
}
