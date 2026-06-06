/**
 * Обработчик действия PICKUP — поднятие предмета с пола.
 *
 * Логика:
 * - Проверяет, есть ли предмет на клетке актёра.
 * - Если есть — порождает PickUpIntent для первого найденного предмета.
 */

import { GameState } from "@simulation/types.ts";
import { findEntity, findAllEntitiesAt } from "@simulation/state.ts";
import { ActionHandler, ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { Intent } from "@simulation/systems/intents/types.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";

export const pickupEntity: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'PICKUP') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }

    const actor = findEntity(state, action.entityId);
    if (!actor) {
      return { ok: false, reasonCode: 'entity_not_exists' };
    }

    const items = findAllEntitiesAt(state, actor.x, actor.y).filter(e => e.type === 'item');
    if (items.length === 0) {
      return { ok: false, reasonCode: 'no_item_here' };
    }

    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'PICKUP') {
      return [];
    }

    const actor = findEntity(state, action.entityId);
    if (!actor) {
      return [];
    }

    const items = findAllEntitiesAt(state, actor.x, actor.y).filter(e => e.type === 'item');
    if (items.length === 0) {
      return [];
    }

    const item = items[0];
    if (!item) {
      return [];
    }

    return [{
      type: 'PICK_UP' as const,
      entityId: action.entityId,
      itemId: item.id,
      templateId: item.templateId,
    }];
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
