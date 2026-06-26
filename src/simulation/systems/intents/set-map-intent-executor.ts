/**
 * Исполнитель интента SET_MAP.
 *
 * Контракт:
 * - Устанавливает `state.map`.
 * - Пересоздаёт `state.visible` под размер новой карты.
 * - Устанавливает `state.explored` из интента или создаёт пустую сетку.
 * - Порождает событие MAP_CHANGED.
 */

import { GameState } from '@simulation/types';
import { SetMapIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { createBoolGrid } from '@simulation/state';

export const executeSetMapIntent: IntentExecutor<SetMapIntent> = (
  state: GameState,
  intent: SetMapIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  state.map = intent.map;
  state.visible = createBoolGrid(intent.map.width, intent.map.height, false);
  state.explored = intent.explored ?? createBoolGrid(intent.map.width, intent.map.height, false);

  return builder.addChild(parent, {
    type: 'MAP_CHANGED',
    width: intent.map.width,
    height: intent.map.height,
  });
};
