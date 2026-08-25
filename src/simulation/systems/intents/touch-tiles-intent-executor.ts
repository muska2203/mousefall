/**
 * Исполнитель интента TOUCH_TILES.
 *
 * Контракт:
 * - Состояние не меняет: интент только фиксирует доменный факт «действие
 *   коснулось этих клеток» (зона поиска, зона удара и т.п.).
 * - Порождает событие TILES_AFFECTED (полевое, участвует в FOV-фильтрации)
 *   с affectedPositions из интента. Позиция узла в дереве исполнения задаёт
 *   момент касания для анимации (см. docs/agents/PRESENTATION_CONTRACT.md §2.9).
 * - Пустой список клеток — возвращает null (событие не нужно).
 */

import type {GameState} from '@simulation/types';
import type {TouchTilesIntent} from '@simulation/core-types';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {IntentExecutor} from './types';

export const executeTouchTilesIntent: IntentExecutor<TouchTilesIntent> = (
  _state: GameState,
  intent: TouchTilesIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  if (intent.positions.length === 0) return null;

  return executionBuilder.addChild(parent, {
    type: 'TILES_AFFECTED', isFieldEvent: true,
    affectedPositions: intent.positions,
  });
};
