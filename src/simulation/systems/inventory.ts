/**
 * Система инвентаря.
 *
 * Обрабатывает подбор, сброс и использование предметов.
 *
 * Контракт: все функции → GameEvent[]
 * - Мутирует state.player.inventory и state.items
 * - Возвращает события, описывающие произошедшее
 */

import type {EntityId, GameEvent, GameState, ItemInstanceId} from '../types';
import {MAX_INVENTORY_SIZE} from '../../utils/constants';

// /**
//  * Подобрать предмет с пола и добавить его в инвентарь сущности.
//  * Только игрок может подбирать предметы.
//  */
// export function pickupItem(
//   state: GameState,
//   entityId: EntityId,
//   floorItemId: EntityId,
// ): GameEvent[] {
//   // Только игрок подбирает предметы
//   if (entityId !== state.player.id) return [];
//
//   const floorItem = state.items.find(i => i.id === floorItemId);
//   if (!floorItem) return [];
//
//   // Проверка вместимости инвентаря
//   if (state.player.inventory.length >= MAX_INVENTORY_SIZE) return [];
//
//   // Генерация instance ID
//   const instanceId: ItemInstanceId = `item_inst_${Date.now()}_${Math.random().toString(36).slice(2)}`;
//
//   // Проверка, есть ли уже стакабельный предмет в инвентаре
//   const existing = state.player.inventory.find(
//     i => i.templateId === floorItem.templateId,
//   );
//
//   if (existing) {
//     // TODO: проверить maxStack из реестра контента
//     existing.quantity += floorItem.quantity;
//   } else {
//     state.player.inventory.push({
//       instanceId,
//       templateId: floorItem.templateId,
//       quantity: floorItem.quantity,
//     });
//   }
//
//   // Remove from floor
//   state.items = state.items.filter(i => i.id !== floorItemId);
//
//   return [{
//     type: 'ITEM_PICKED_UP',
//     entityId,
//     itemInstanceId: instanceId,
//     templateId: floorItem.templateId,
//   }];
// }
//
// /**
//  * Сбросить предмет из инвентаря на пол в позиции сущности.
//  */
// export function dropItem(
//   state: GameState,
//   entityId: EntityId,
//   itemInstanceId: ItemInstanceId,
// ): GameEvent[] {
//   if (entityId !== state.player.id) return [];
//
//   const invItem = state.player.inventory.find(i => i.instanceId === itemInstanceId);
//   if (!invItem) return [];
//
//   const dropPos = { x: state.player.x, y: state.player.y };
//
//   // Добавление на пол
//   state.items.push({
//     id: `floor_${itemInstanceId}`,
//     x: dropPos.x,
//     y: dropPos.y,
//     templateId: invItem.templateId,
//     quantity: invItem.quantity,
//   });
//
//   // Удаление из инвентаря
//   state.player.inventory = state.player.inventory.filter(
//     i => i.instanceId !== itemInstanceId,
//   );
//
//   return [{
//     type: 'ITEM_DROPPED',
//     entityId,
//     itemInstanceId,
//     position: dropPos,
//   }];
// }
//
// /**
//  * Использовать расходуемый предмет из инвентаря.
//  * Применение эффекта — TODO, требует интеграции с реестром контента.
//  */
// export function useItem(
//   state: GameState,
//   entityId: EntityId,
//   itemInstanceId: ItemInstanceId,
// ): GameEvent[] {
//   if (entityId !== state.player.id) return [];
//
//   const invItem = state.player.inventory.find(i => i.instanceId === itemInstanceId);
//   if (!invItem) return [];
//
//   // TODO: найти шаблон в реестре контента, применить эффект
//   // Пока что: просто потратить предмет
//
//   if (invItem.quantity > 1) {
//     invItem.quantity -= 1;
//   } else {
//     state.player.inventory = state.player.inventory.filter(
//       i => i.instanceId !== itemInstanceId,
//     );
//   }
//
//   return [{
//     type: 'ITEM_USED',
//     entityId,
//     itemInstanceId,
//     templateId: invItem.templateId,
//   }];
// }
