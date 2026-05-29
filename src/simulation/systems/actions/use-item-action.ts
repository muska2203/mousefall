/**
 * Обработчик действия USE_ITEM — использование расходуемого предмета из инвентаря.
 *
 * Логика:
 * - Проверяет, что предмет есть в инвентаре и является consumable.
 * - Разрешает эффект в зависимости от consumable.effect:
 *   heal → HEAL + CONSUME_AP + REMOVE_ITEM
 *   buff → APPLY_STATUS + CONSUME_AP + REMOVE_ITEM
 *   Прочие эффекты пока не реализованы.
 */

import { GameState } from "@simulation/types.ts";
import { getItem } from "@content/registry";
import { ActionHandler, ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { Intent } from "@simulation/systems/intents/types.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";

export const useItemAction: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'USE_ITEM') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected USE_ITEM action' };
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId);
    if (!item) {
      return { ok: false, reasonCode: 'item_not_found', reasonDescription: 'Предмет не найден в инвентаре' };
    }

    const template = getItem(item.templateId);
    if (template.type !== 'consumable' || !template.consumable) {
      return { ok: false, reasonCode: 'not_consumable', reasonDescription: 'Предмет нельзя использовать' };
    }

    const supportedEffects = ['heal', 'buff'];
    if (!supportedEffects.includes(template.consumable.effect)) {
      return { ok: false, reasonCode: 'unsupported_effect', reasonDescription: `Эффект предмета "${template.consumable.effect}" не поддерживается` };
    }

    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'USE_ITEM') {
      return [];
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId);
    if (!item) {
      return [];
    }
    const template = getItem(item.templateId);
    const effect = template.consumable!;

    const intents: Intent[] = [];

    switch (effect.effect) {
      case 'heal': {
        intents.push({
          type: 'HEAL',
          entityId: action.entityId,
          amount: effect.value ?? 0,
        });
        break;
      }
      case 'buff': {
        // TODO: определить конкретный статус-эффект на основе template
        intents.push({
          type: 'APPLY_STATUS',
          entityId: action.entityId,
          status: {
            type: 'regenerating',
            duration: effect.duration ?? 3,
            value: effect.value ?? 0,
            statModifiers: null,
          },
        });
        break;
      }
      default: {
        // damage, teleport, identify — пока не реализованы
        return [];
      }
    }

    intents.push(
      { type: 'CONSUME_AP', entityId: action.entityId, amount: 1 },
      { type: 'REMOVE_ITEM', entityId: action.entityId, itemInstanceId: item.instanceId, templateId: item.templateId },
    );

    return intents;
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
