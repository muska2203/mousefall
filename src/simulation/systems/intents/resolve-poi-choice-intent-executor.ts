/**
 * Исполнитель интента RESOLVE_POI_CHOICE.
 *
 * Применяет выбор опции в открытом окне poi: делегирует механике окна
 * (`POI_WINDOW_MECHANICS` по `kind` из шаблона). Механика сама порождает
 * события эффекта (например, RELIC_GRANTED через GRANT_RELIC), тратит
 * заряд при `chargeSpentOn: 'resolution'` и очищает предложение.
 *
 * Отказы (возврат null): poi не существует или не poi, у шаблона нет окна,
 * механика отклонила выбор (невалидная опция, нет зарядов).
 */

import type {GameState} from '@simulation/types';
import type {ResolvePoiChoiceIntent} from '@simulation/core-types';
import {tryGetPoi} from '@content/registry';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {POI_WINDOW_MECHANICS} from '@simulation/systems/poi-windows';
import type {IntentExecutor} from './types';

export const executeResolvePoiChoiceIntent: IntentExecutor<ResolvePoiChoiceIntent> = (
  state: GameState,
  intent: ResolvePoiChoiceIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const poi = state.entities.get(intent.poiId);
  if (!poi || poi.type !== 'poi') return null;

  const template = tryGetPoi(poi.templateId);
  if (!template?.window) return null;

  const mechanic = POI_WINDOW_MECHANICS[template.window.kind];
  return mechanic.resolve(state, poi, intent.optionId, executionBuilder, parent);
};
