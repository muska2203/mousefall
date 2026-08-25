/**
 * Исполнитель интента COMPLETE_RUN.
 *
 * Контракт:
 * - Завершает забег победой: выставляет `state.phase = 'victory'`.
 * - Порождает единственное событие `RUN_COMPLETED` (не полевое — без FOV-фильтрации,
 *   по образцу PLAYER_DIED).
 * - Новый этаж не генерируется: интент подменяет FLOOR_TRANSITION при спуске
 *   с финального этажа (`MapParams.finalFloor`, roadMap 1.5).
 */

import type {GameState} from '@simulation/types';
import type {ExecutionBuilder, ExecutionNode, CompleteRunIntent} from '@simulation/core-types';
import type {IntentExecutor} from './types';

export const executeCompleteRunIntent: IntentExecutor<CompleteRunIntent> = (
  state: GameState,
  _intent: CompleteRunIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  state.phase = 'victory';
  return builder.addChild(parent, { type: 'RUN_COMPLETED', isFieldEvent: false });
};
