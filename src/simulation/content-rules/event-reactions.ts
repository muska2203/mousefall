/**
 * Точка врезки реакций контентных правил на игровые события.
 *
 * При выключенном флаге `contentRulesEnabled` возвращает пустой массив,
 * не влияя на старый боевой цикл.
 */

import type {ExecutionBuilder, ExecutionNode, GameEvent, Intent} from '@simulation/core-types.ts';
import type {GameState} from '@simulation/types.ts';
import {runContentRuleReactions} from './reaction/content-rule-reaction.ts';
import {isContentRulesEnabled} from './feature-flags.ts';

/**
 * Запускает контентные реакции на событие, только если включен флаг
 * контентных правил. Иначе возвращает пустой массив интентов.
 */
export function runContentRuleReactionsIfEnabled(
  state: GameState,
  event: GameEvent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): Intent[] {
  return isContentRulesEnabled(state) ? runContentRuleReactions(state, event, builder, parent) : [];
}
