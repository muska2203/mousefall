/**
 * Исполнитель интента уведомления AI-стратегии об изменении мира.
 *
 * Контракт:
 * - Находит AI-актора по entityId.
 * - Вызывает зарегистрированную стратегию `onWorldChange`.
 * - Порождает событие AI_NOTIFIED для отслеживания в дереве выполнения.
 *
 * Если стратегия для актора не зарегистрирована — это ошибка конфигурации:
 * в полном приложении все стратегии импортируются в simulation.ts.
 */

import type {GameState} from '@simulation/types';
import type {NotifyAIIntent} from '@simulation/core-types';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {IntentExecutor} from './types';
import {findEntity} from '@simulation/state';
import {isEnemyEntity} from '@simulation/ai/ai-state';
import {getStrategy} from '@simulation/ai/strategy-registry';

export const executeNotifyAIIntent: IntentExecutor<NotifyAIIntent> = (
  state: GameState,
  intent: NotifyAIIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const actor = findEntity(state, intent.entityId);
  if (!actor || !isEnemyEntity(actor)) {
    return null;
  }

  const strategy = getStrategy(actor.aiStrategyId);

  strategy.onWorldChange?.(actor, state, intent.change);

  return builder.addChild(parent, {
    type: 'AI_NOTIFIED',
    entityId: actor.id,
    change: intent.change,
  });
};
