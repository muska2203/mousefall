/**
 * Builder для события ACTION_APPLIED.
 */

import type {AnimationBuilder} from '../core/registry';
import {attackNode, itemThrowNode} from '../core/primitives';
import {tryGetItem} from '@content/registry';

export const actionAppliedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'ACTION_APPLIED') return null;

  const action = event.action;

  // Бросок расходника с выбором клетки: анимируем полёт спрайта предмета.
  if (action.type === 'USE_ITEM' && action.targetPosition) {
    const actor =
      state.entities.get(action.entityId) ??
      (state.player.id === action.entityId ? state.player : undefined);
    if (!actor) return null;

    // Предмет уже мог быть расходован, поэтому сначала пробуем templateId из действия.
    const templateId = action.templateId ?? (() => {
      if (!('inventory' in actor)) return undefined;
      const item = actor.inventory.find(i => i.instanceId === action.itemInstanceId);
      return item?.templateId;
    })();
    if (!templateId) return null;

    const template = tryGetItem(templateId);
    if (!template || template.type !== 'consumable' || !template.consumable) return null;
    if (template.consumable.effect !== 'spawn_tile_effect') return null;

    const spriteId = template.spriteId ?? template.id;
    return [
      itemThrowNode(
        { x: actor.x, y: actor.y },
        action.targetPosition,
        template.id,
        spriteId,
        children,
        action.entityId,
      ),
    ];
  }

  const node = attackNode(event, children);
  return node ? [node] : null;
};
