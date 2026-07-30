/**
 * Исполнитель интента SET_MAP.
 *
 * Контракт:
 * - Устанавливает `state.map`.
 * - Пересоздаёт `state.visible` под размер новой карты.
 * - Устанавливает `state.explored` из интента или создаёт пустую сетку.
 * - Устанавливает `state.tileEffects` из интента (восстановление этажа)
 *   или создаёт пустую сетку под фактический размер новой карты.
 * - Порождает событие MAP_CHANGED.
 */

import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, SetMapIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {createBoolGrid, createTileEffectsGrid} from '@simulation/state';

export const executeSetMapIntent: IntentExecutor<SetMapIntent> = (
  state: GameState,
  intent: SetMapIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  state.map = intent.map;
  state.visible = createBoolGrid(intent.map.width, intent.map.height, false);
  state.explored = intent.explored ?? createBoolGrid(intent.map.width, intent.map.height, false);
  state.tileEffects = intent.tileEffects ?? createTileEffectsGrid(intent.map.width, intent.map.height);

  return builder.addChild(parent, {
    type: 'MAP_CHANGED', isFieldEvent: false,
    width: intent.map.width,
    height: intent.map.height,
  });
};
