import {GameState} from "@simulation/types.ts";
import {findEntity, isBlocked} from "@simulation/state.ts";
import {IntentExecutor, MoveIntent} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode, MoveAction} from "@simulation/systems/actions/types.ts";

export const executeMoveIntent: IntentExecutor<MoveAction> = (
    state: GameState,
    intent: MoveIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const entity = findEntity(state, intent.entityId);
    if (entity) {
        const newX = entity.x + intent.dx;
        const newY = entity.y + intent.dy;
        if(!isBlocked(state, newX, newY)) {
            const from = { x: entity.x, y: entity.y };
            entity.x = newX;
            entity.y = newY;
            const to = { x: newX, y: newY };
            return builder.addChild(parent, { type: 'ENTITY_MOVED', entityId: intent.entityId, from, to });
        }
    }
    return null;


    // TODO: Нужно создать intent executor для поднятия лута и других действий, которые могут быть выполнены после передвижения, и зарегистрировать их в world-reaction

}