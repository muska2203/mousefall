import {WorldReaction} from "@simulation/systems/world-reactions/types.ts";
import {EntityDamagedEvent} from "@simulation/types.ts";
import {executeIntent} from "@simulation/systems/intents/execute-intent.ts";
import {findAttackableEntity} from "@simulation/state.ts";

export const deathReaction: WorldReaction<EntityDamagedEvent> = (
    state,
    event,
    builder,
    parent,
) => {
    const entity = findAttackableEntity(state, event.targetId);

    if (!entity) return;

    if (entity.hp > 0) return;

    const deathPos = { x: entity.x, y: entity.y };
    executeIntent(
        state,
        {
            type: 'DIE',
            entityId: entity.id,
            position: deathPos
        },
        builder,
        parent,
    );
};