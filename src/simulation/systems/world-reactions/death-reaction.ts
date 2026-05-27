import {WorldReaction} from './types';
import {findAttackableEntity} from '@simulation/state';

export const deathReaction: WorldReaction = (
    state,
    event,
    _builder,
    _parent,
) => {
    if (event.type !== 'ENTITY_DAMAGED') return [];

    const entity = findAttackableEntity(state, event.targetId);

    if (!entity) return [];

    if (entity.hp > 0) return [];

    if (entity.isAlive === false) return [];

    const deathPos = { x: entity.x, y: entity.y };
    return [
        {
            type: 'DIE',
            entityId: entity.id,
            position: deathPos,
        },
    ];
};
