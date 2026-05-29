/**
 * Фабрика создания ItemEntity — предмета на игровом поле.
 *
 * Инкапсулирует инвариант: entity.id === item.instanceId.
 * Используется при генерации карты и спавне лута.
 */

import type { GameState, ItemEntity } from '@simulation/types';
import { getItem } from '@content/registry';
import { createInventoryItem } from './inventory-factory';

/**
 * Создаёт ItemEntity в указанной позиции.
 *
 * Гарантирует, что id сущности совпадает с instanceId инвентарного предмета.
 */
export function createItemEntity(
  state: GameState,
  templateId: string,
  x: number,
  y: number,
): ItemEntity {
  const template = getItem(templateId);
  const inventoryItem = createInventoryItem(state, templateId);

  return {
    id: inventoryItem.instanceId,
    type: 'item',
    templateId,
    x,
    y,
    displayName: template.name,
    blocksMovement: false,
    item: inventoryItem,
  };
}
