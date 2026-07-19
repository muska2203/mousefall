/**
 * Фабрики создания сущностей предметов на игровом поле.
 *
 * `createFloorItemContainer` — контейнер предмета на полу, используемый в системе взаимодействий.
 */

import type {FloorItemContainerEntity, GameState, InventoryItem, Position} from '@simulation/types';
import {nextEntityId} from '@simulation/state';

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
