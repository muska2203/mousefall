/**
 * Система передвижения.
 *
 * Обрабатывает перемещение сущностей по сетке.
 * Bump-attack: при движении в клетку врага срабатывает атака вместо перемещения.
 *
 * Контракт: (state, entityId, dx, dy) → GameEvent[]
 * - Мутирует позицию state.player или врагов
 * - Возвращает события, описывающие произошедшее
 */

import type {GameState} from '@simulation/types.ts';
import {findEntity, isBlocked} from '@simulation/state.ts';
import {executeIntent} from '@simulation/systems/intents/execute-intent.ts';
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export const moveEntity: ActionHandler = {

    validate(state: GameState, action) {
        if (action.type !== 'MOVE') {
            return {ok: false, reasonCode: 'wrong_action_type'};
        }

        const entity = findEntity(state, action.entityId);

        if (!entity) return {ok: false, reasonCode: "entity_not_exists"};

        const newX = entity.x + action.dx;
        const newY = entity.y + action.dy;
        if (isBlocked(state, newX, newY)) {
            return {ok: false, reasonCode: "tile_blocked"};
        }
        return {ok: true};
    },

    resolve(state: GameState, action) {
        if (action.type !== 'MOVE') {
            return [];
        }
        return [{type: 'MOVE', entityId: action.entityId, dx: action.dx, dy: action.dy}];
    },

    execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
        for (const intent of intents) {
            executeIntent(state, intent, executionBuilder, parentNode);
        }
    }
};
