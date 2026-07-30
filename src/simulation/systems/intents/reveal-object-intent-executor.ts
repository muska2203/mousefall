/**
 * Исполнитель интента REVEAL_OBJECT.
 *
 * Контракт:
 * - Раскрывает скрытую ловушку (hidden = false): постоянная ловушка остаётся
 *   на поле и может срабатывать повторно.
 * - Порождает событие OBJECT_REVEALED (полевое, участвует в FOV-фильтрации).
 * - Сущности нет, она не ловушка или уже раскрыта — возвращает null.
 */

import type {GameState} from '@simulation/types';
import type {RevealObjectIntent} from '@simulation/core-types';
import {findEntity} from '@simulation/state';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {IntentExecutor} from './types';

export const executeRevealObjectIntent: IntentExecutor<RevealObjectIntent> = (
  state: GameState,
  intent: RevealObjectIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || entity.type !== 'trap' || !entity.hidden) return null;

  entity.hidden = false;

  return executionBuilder.addChild(parent, {
    type: 'OBJECT_REVEALED', isFieldEvent: true,
    entityId: intent.entityId,
    objectType: entity.templateId,
    position: { x: entity.x, y: entity.y },
  });
};
