/**
 * Исполнитель интента APPLY_FOG_EVENTS.
 *
 * Контракт:
 * - Применяет к `state.visible` / `state.explored` уже вычисленные FOV-события.
 * - Добавляет каждое событие `FOG_UPDATED` как дочерний узел дерева выполнения.
 *
 * Используется при переходе между этажами, где FOV предварительно рассчитан
 * планировщиком (`computeFloorTransition`) во временном состоянии.
 */

import type { GameState } from '@simulation/types';
import type { ApplyFogEventsIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import type { IntentExecutor } from '@simulation/systems/intents/types';

export const executeApplyFogEventsIntent: IntentExecutor<ApplyFogEventsIntent> = (
  state: GameState,
  intent: ApplyFogEventsIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  let lastNode: ExecutionNode | null = null;

  for (const event of intent.events) {
    for (const pos of event.newlyVisible) {
      if (pos.y >= 0 && pos.y < state.visible.length && pos.x >= 0 && pos.x < state.visible[pos.y]!.length) {
        state.visible[pos.y]![pos.x] = true;
      }
      if (pos.y >= 0 && pos.y < state.explored.length && pos.x >= 0 && pos.x < state.explored[pos.y]!.length) {
        state.explored[pos.y]![pos.x] = true;
      }
    }
    lastNode = builder.addChild(parent, event);
  }

  return lastNode;
};
