/**
 * Исполнитель интента ACTIVATE_POI.
 *
 * Контракт:
 * - Разовость точки интереса обеспечивается процедурно: исполнитель проверяет
 *   `charges > 0` и декрементит заряды. Декларативные правила из `ruleIds`
 *   шаблона описывают только эффект и срабатывают на событие POI_USED.
 * - Порождает событие POI_USED (полевое, участвует в FOV-фильтрации).
 */

import type {GameState} from '@simulation/types';
import type {ActivatePoiIntent} from '@simulation/core-types';
import {findPoiAt} from '@simulation/state';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {IntentExecutor} from './types';

export const executeActivatePoiIntent: IntentExecutor<ActivatePoiIntent> = (
  state: GameState,
  intent: ActivatePoiIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const poi = findPoiAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!poi) return null;

  // Заряды исчерпаны — активация не происходит (правила не срабатывают).
  if (poi.charges <= 0) return null;

  poi.charges -= 1;

  return executionBuilder.addChild(parent, {
    type: 'POI_USED', isFieldEvent: true,
    entityId: intent.entityId,
    poiId: poi.id,
    poiType: poi.templateId,
    position: { x: poi.x, y: poi.y },
    remainingCharges: poi.charges,
  });
};
