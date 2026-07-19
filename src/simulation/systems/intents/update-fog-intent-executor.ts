/**
 * Исполнитель интента UPDATE_FOG.
 *
 * Контракт:
 * - Вызывает `updateFOV(state)`.
 * - Добавляет возвращённые события FOG_UPDATED как дочерние узлы к `parent`.
 * - Если новых видимых клеток нет, возвращает null.
 */

import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, UpdateFogIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {updateFOV} from '@simulation/systems/fov';

export const executeUpdateFogIntent: IntentExecutor<UpdateFogIntent> = (
  state: GameState,
  _intent: UpdateFogIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const fovEvents = updateFOV(state);

  for (const event of fovEvents) {
    builder.addChild(parent, event);
  }

  return null;
};
