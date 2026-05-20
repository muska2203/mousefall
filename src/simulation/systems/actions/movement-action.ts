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

import type {GameState} from '../../types.ts';
import {findEntity, isBlocked} from '../../state.ts';
import {executeIntent} from '@simulation/systems/intents/execute-intent.ts';
import {ActionHandler, ExecutionBuilder, ExecutionNode, MoveAction} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export const moveEntity: ActionHandler<MoveAction> = {

    validate(state: GameState, action: MoveAction) {
        const entity = findEntity(state, action.entityId);

        if (!entity) return {ok: false, reasonCode: "entity_not_exists", reasonDescription: 'Entity not exists'};

        const newX = entity.x + action.dx;
        const newY = entity.y + action.dy;
        if (isBlocked(state, newX, newY)) {
            return {ok: false, reasonCode: "tile_blocked", reasonDescription: "Tile is blocked"};
        }
        return {ok: true};
    },
    
    resolve(state: GameState, action: MoveAction) {
        return [{type: 'MOVE', entityId: action.entityId, dx: action.dx, dy: action.dy}];
    },
    
    execute(state: GameState, action: MoveAction, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
        for (const intent of intents) {
            executeIntent(state, intent, executionBuilder, parentNode);
        }
    }
};
