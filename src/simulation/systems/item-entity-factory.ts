/**
 * Фабрики создания сущностей предметов на игровом поле.
 *
 * `createFloorItemContainer` — контейнер предмета на полу, используемый в системе взаимодействий.
 */

import type { GameState, FloorItemContainerEntity, InventoryItem, Position } from '@simulation/types';
import { getItem } from '@content/registry';
import { nextEntityId } from '@simulation/state';
import { createInventoryItem } from './inventory-factory';

/**
 * Создаёт FloorItemContainerEntity в указанной позиции.
 *
 * id контейнера генерируется отдельно от instanceId предмета.
 */
export function createFloorItemContainer(
  state: GameState,
  item: InventoryItem,
  position: Position,
): FloorItemContainerEntity {
  return {
    id: nextEntityId(state, 'floor_item_container'),
    type: 'floor_item_container',
    x: position.x,
    y: position.y,
    displayName: item.templateId,
    interactionKind: 'item',
    item,
    blocksMovement: false,
    templateId: item.templateId,
  };
}
