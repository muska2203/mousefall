/**
 * Обработчик debug-действия DEBUG_SPAWN_ENTITY.
 *
 * Создаёт на карте произвольный игровой объект: предмет, врага, дверь или лестницу.
 * Доступно только при включённом debug-режиме.
 */

import {GameState} from '@simulation/types.ts';
import {tryGetDoor, tryGetEntity, tryGetItem, tryGetPoi, tryGetProp, tryGetStairs, tryGetTrap} from '@content/registry';
import {canPlaceObjectAt, findAllEntitiesAt, PlacementSlot, terrainHasTag} from '@simulation/state.ts';
import {createFloorItemContainer} from '@simulation/systems/item-entity-factory.ts';
import {createInventoryItem} from '@simulation/systems/inventory-factory.ts';
import {createDoor, createEnemy, createPoi, createProp, createStairs, createTrap} from '@simulation/systems/mapgen.ts';
import {ActionHandler, ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import {Intent} from '@simulation/systems/intents/types.ts';
import type {DebugContext} from './debug-add-item-action.ts';

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

      if (!terrainHasTag(state.map.tiles[y]?.[x], 'ground')) {
        return { ok: false, reasonCode: 'not_a_floor_tile' };
      }

      const itemTemplate = tryGetItem(templateId);
      const entityTemplate = tryGetEntity(templateId);
      const doorTemplate = tryGetDoor(templateId);
      const stairsTemplate = tryGetStairs(templateId);
      const propTemplate = tryGetProp(templateId);
      const poiTemplate = tryGetPoi(templateId);
      const trapTemplate = tryGetTrap(templateId);

      const templateExists =
        (spawnType === 'item' && itemTemplate !== undefined) ||
        (spawnType === 'enemy' && entityTemplate !== undefined) ||
        (spawnType === 'door' && doorTemplate !== undefined) ||
        (spawnType === 'stairs' && stairsTemplate !== undefined) ||
        (spawnType === 'prop' && propTemplate !== undefined) ||
        (spawnType === 'poi' && poiTemplate !== undefined) ||
        (spawnType === 'trap' && trapTemplate !== undefined);

      if (!templateExists) {
        return { ok: false, reasonCode: 'template_not_found' };
      }

      const entitiesHere = findAllEntitiesAt(state, x, y);

      // Врага (актора) нельзя ставить на любую занятую клетку (включая игрока).
      if (spawnType === 'enemy' && entitiesHere.length > 0) {
        return { ok: false, reasonCode: 'tile_occupied' };
      }

      // Слоты размещения объектов: дверь/проп/точка интереса — solid,
      // лестница/ловушка — floorFixture, предмет — loot. Проверка единая — canPlaceObjectAt.
      const slotBySpawnType: Partial<Record<typeof spawnType, PlacementSlot>> = {
        door: 'solid',
        prop: 'solid',
        poi: 'solid',
        stairs: 'floorFixture',
        trap: 'floorFixture',
        item: 'loot',
      };
      const slot = slotBySpawnType[spawnType];
      if (slot !== undefined && !canPlaceObjectAt(state, slot, { x, y })) {
        return { ok: false, reasonCode: 'tile_occupied' };
      }
      // solid нельзя ставить на клетку с блокирующей движение сущностью (актором, включая игрока).
      if (slot === 'solid' && entitiesHere.some(e => e.blocksMovement)) {
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
        case 'item': {
          const inventoryItem = createInventoryItem(state, templateId);
          entity = createFloorItemContainer(state, inventoryItem, { x, y });
          break;
        }
        case 'enemy':
          entity = createEnemy(state, templateId, x, y);
          break;
        case 'door':
          entity = createDoor(state, templateId, x, y);
          break;
        case 'stairs': {
          // В реестре лестниц ожидаются только stairs_down / stairs_up.
          const direction = templateId === 'stairs_up' ? 'up' : 'down';
          entity = createStairs(state, templateId, direction, x, y);
          break;
        }
        case 'prop':
          entity = createProp(state, templateId, x, y);
          break;
        case 'poi':
          entity = createPoi(state, templateId, x, y);
          break;
        case 'trap':
          entity = createTrap(state, templateId, x, y);
          break;
        default:
          return;
      }

      state.entities.set(entity.id, entity);
    },
  };
}
