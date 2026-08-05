/**
 * Исполнитель интента ACTIVATE_POI.
 *
 * Контракт:
 * - Разовость точки интереса обеспечивается процедурно: исполнитель проверяет
 *   `charges > 0` и декрементит заряды. Декларативные правила из `ruleIds`
 *   шаблона описывают только эффект и срабатывают на событие POI_USED.
 * - Poi с окном (`window` в шаблоне): активация делегируется механике окна
 *   (`POI_WINDOW_MECHANICS`), которая готовит предложение (`poi.offer`).
 *   При `chargeSpentOn: 'resolution'` заряд тратится не здесь, а при выборе
 *   опции окна (исполнитель RESOLVE_POI_CHOICE). Если механика не открыла
 *   окно (вернула false) — активация не состоялась.
 * - Порождает событие POI_USED (полевое, участвует в FOV-фильтрации).
 */

import type {GameState} from '@simulation/types';
import type {ActivatePoiIntent} from '@simulation/core-types';
import {findPoiAt} from '@simulation/state';
import {tryGetPoi} from '@content/registry';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {POI_WINDOW_MECHANICS} from '@simulation/systems/poi-windows';
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

  const template = tryGetPoi(poi.templateId);

  if (template?.window) {
    const mechanic = POI_WINDOW_MECHANICS[template.window.kind];
    // Механика не открыла окно (пустой пул и пр.) — активация не состоялась.
    if (!mechanic.onActivate(state, poi, template)) return null;

    // При chargeSpentOn: 'resolution' заряд тратится при выборе опции окна.
    if (template.chargeSpentOn === 'activation') {
      poi.charges -= 1;
    }
  } else {
    poi.charges -= 1;
  }

  return executionBuilder.addChild(parent, {
    type: 'POI_USED', isFieldEvent: true,
    entityId: intent.entityId,
    poiId: poi.id,
    poiType: poi.templateId,
    position: { x: poi.x, y: poi.y },
    remainingCharges: poi.charges,
  });
};
