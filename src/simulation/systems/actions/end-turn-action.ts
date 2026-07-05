import {GameState} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

/**
 * Обработчик действия END_TURN — явное завершение хода актора.
 *
 * Логика:
 * - Не порождает собственных интентов.
 * - Стоимость AP вычисляется в `DefaultActionPointCostResolver`: `END_TURN` стоит 0.
 * - Основная логика завершения хода (пометка актора как закончившего ход,
 *   переход к следующему актору) находится в `GameSimulation.dispatch`.
 */
export const endTurnEntity: ActionHandler = {

    validate(state: GameState, action) {
        if (action.type !== 'END_TURN') {
            return {ok: false, reasonCode: 'wrong_action_type'};
        }
        return {ok: true};
    },

    resolve(state: GameState, action) {
        if (action.type !== 'END_TURN') {
            return [];
        }
        return [];
    },

    execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {

    }
};
