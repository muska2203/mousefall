/**
 * Обработчик действия RESOLVE_POI_CHOICE — выбор опции в открытом окне poi.
 *
 * Контракт:
 * - Завершение взаимодействия с оконным poi: стоимость 1 AP
 *   (см. DefaultActionPointCostResolver). AP списывается при выходе из окна,
 *   а не при его открытии (активация оконного poi бесплатна).
 * - validate проверяет, что poi существует, имеет окно с заполненным
 *   предложением (`offer`), заряды и что `optionId` входит в предложение.
 * - resolve порождает одноимённый интент; эффект выбора применяет
 *   механика окна в исполнителе интента.
 */

import type {GameState, ValidationResult} from '@simulation/types';
import type {Intent} from '@simulation/core-types';
import {tryGetPoi} from '@content/registry';
import {POI_WINDOW_MECHANICS} from '@simulation/systems/poi-windows';
import type {ActionHandler} from './types';
import {executeIntents} from '@simulation/systems/intents/execute-intent.ts';

export const resolvePoiChoiceAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'RESOLVE_POI_CHOICE') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }

    const poi = state.entities.get(action.poiId);
    if (!poi || poi.type !== 'poi') {
      return { ok: false, reasonCode: 'poi_not_found' };
    }
    if (poi.charges <= 0) {
      return { ok: false, reasonCode: 'poi_depleted' };
    }

    const template = tryGetPoi(poi.templateId);
    if (!template?.window) {
      return { ok: false, reasonCode: 'poi_has_no_window' };
    }
    if (!poi.offer || !poi.offer.includes(action.optionId)) {
      return { ok: false, reasonCode: 'invalid_window_option' };
    }

    // Предложение могло протухнуть с момента генерации — без проверки
    // применимости выбор молча тратил бы 1 AP без эффекта.
    const mechanic = POI_WINDOW_MECHANICS[template.window.kind];
    if (mechanic.canResolve && !mechanic.canResolve(state, poi, action.optionId)) {
      return { ok: false, reasonCode: 'invalid_window_option' };
    }

    return { ok: true };
  },

  resolve(state: GameState, action): Intent[] {
    if (action.type !== 'RESOLVE_POI_CHOICE') {
      return [];
    }

    return [{
      type: 'RESOLVE_POI_CHOICE',
      entityId: action.entityId,
      poiId: action.poiId,
      optionId: action.optionId,
    }];
  },

  execute(state: GameState, _action, intents: Intent[], executionBuilder, parentNode) {
    executeIntents(state, intents, executionBuilder, parentNode);
  },
};
