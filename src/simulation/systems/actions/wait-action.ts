import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

/**
 * Обработчик действия WAIT — завершение хода актора.
 *
 * Логика:
 * - Не порождает собственных интентов.
 * - Стоимость AP вычисляется в `DefaultActionPointCostResolver`: `WAIT` стоит
 *   текущее количество AP актора (`actor.ap`).
 * - Центральное списание AP в `GameSimulation.executeAction` списывает все AP,
 *   что приводит к `isPlayerExhausted()` и автоматическому запуску хода врагов.
 */
export const waitEntity: ActionHandler = {

    validate(state: GameState, action) {
        if (action.type !== 'WAIT') {
            return {ok: false, reasonCode: 'wrong_action_type'};
        }
        return {ok: true};
    },

    resolve(state: GameState, action) {
        if (action.type !== 'WAIT') {
            return [];
        }
        return [];
    },

    execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {

    }
};
