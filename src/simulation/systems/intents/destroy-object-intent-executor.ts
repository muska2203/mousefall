/**
 * Исполнитель интента DESTROY_OBJECT.
 *
 * Контракт:
 * - Удаляет сущность из реестра state.entities (жизненный цикл объектов
 *   процедурный: одноразовая ловушка уничтожается при срабатывании своего правила).
 * - Порождает событие OBJECT_DESTROYED (полевое, участвует в FOV-фильтрации).
 * - Сущности нет — возвращает null (идемпотентность).
 */

import type {GameState} from '@simulation/types';
import type {DestroyObjectIntent} from '@simulation/core-types';
import {findEntity} from '@simulation/state';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {IntentExecutor} from './types';

export const executeDestroyObjectIntent: IntentExecutor<DestroyObjectIntent> = (
  state: GameState,
  intent: DestroyObjectIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity) return null;

  state.entities.delete(intent.entityId);

  return executionBuilder.addChild(parent, {
    type: 'OBJECT_DESTROYED', isFieldEvent: true,
    entityId: intent.entityId,
    objectType: 'templateId' in entity ? entity.templateId : undefined,
    position: { x: entity.x, y: entity.y },
  });
};
