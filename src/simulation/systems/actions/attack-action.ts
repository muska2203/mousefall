import {findAttacker, findFirstAttackableEntityAt} from "@simulation/state.ts";
import {GameState} from "@simulation/types.ts";
import {executeIntent} from "@simulation/systems/intents/execute-intent.ts";
import {ActionHandler, AttackAction, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export const attackEntity: ActionHandler<AttackAction> = {

    validate(state: GameState, action: AttackAction) {
        const entity = findAttacker(state, action.entityId);

        if (!entity) return {ok: false, reasonCode: "entity_not_exists", reasonDescription: 'Entity not exists'};


        const targetX = entity.x + action.dx;
        const targetY = entity.y + action.dy;

        const target = findFirstAttackableEntityAt(state, targetX, targetY)
        if (!target) {
            return {ok: false, reasonCode: "entity_not_exists", reasonDescription: "Not found enemy on the target tile"};
        }
        return {ok: true};
    },
    
    resolve(state: GameState, action: AttackAction) {
        const entity = findAttacker(state, action.entityId);
        if (entity) {
            const targetX = entity.x + action.dx;
            const targetY = entity.y + action.dy;
            const target = findFirstAttackableEntityAt(state, targetX, targetY)
            if (target) {
                return [{type: 'DAMAGE', entityId: target.id, damage: entity.damage}];
            }
        }
        return [];
    },
    
    execute(state: GameState, action: AttackAction, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
        const attackNode = executionBuilder.addChild(parentNode, { type: 'ENTITY_ATTACKED', attackerId: action.entityId, dx: action.dx, dy: action.dy });
        for (const intent of intents) {
            executeIntent(state, intent, executionBuilder, attackNode);
        }
    }
};