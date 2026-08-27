import {GameState} from "@simulation/types.ts";
import {findAllEntitiesAt, findEntity, isBlocked, isTerrainWalkable} from "@simulation/state.ts";
import {IntentExecutor, MoveIntent} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {EntityId} from "@simulation/core-types.ts";

/**
 * Общая логика перемещения сущности: обновляет координаты и порождает
 * событие ENTITY_MOVED с указанным типом движения.
 *
 * Опциональный ignoreBlockedByEntityId разрешает ход на клетку, которую
 * загораживает исключительно указанная сущность: она сдвигается толчком
 * из той же пачки интентов, но её перемещение исполняется волной реакций
 * позже (подставка Налёта — кастер приземляется на клетку жертвы).
 */
export function emitEntityMoved(
    state: GameState,
    entityId: string,
    dx: number,
    dy: number,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
    movementType: 'walk' | 'jump' | 'dash',
    ignoreBlockedByEntityId?: EntityId,
): ExecutionNode | null {
    const entity = findEntity(state, entityId);
    if (!entity) return null;

    const newX = entity.x + dx;
    const newY = entity.y + dy;
    if (isBlocked(state, newX, newY)) {
        const onlyIgnoredBlocker = ignoreBlockedByEntityId !== undefined
            && isTerrainWalkable(state.map.tiles[newY]?.[newX])
            && !findAllEntitiesAt(state, newX, newY).some(e => e.blocksMovement && e.id !== ignoreBlockedByEntityId);
        if (!onlyIgnoredBlocker) return null;
    }

    const from = { x: entity.x, y: entity.y };
    entity.x = newX;
    entity.y = newY;
    const to = { x: newX, y: newY };

    return builder.addChild(parent, { type: 'ENTITY_MOVED', isFieldEvent: true, entityId, from, to, movementType });
}

export const executeMoveIntent: IntentExecutor<MoveIntent> = (
    state: GameState,
    intent: MoveIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    return emitEntityMoved(state, intent.entityId, intent.dx, intent.dy, builder, parent, 'walk');


    // TODO: Нужно создать intent executor для поднятия лута и других действий, которые могут быть выполнены после передвижения, и зарегистрировать их в world-reaction

}
