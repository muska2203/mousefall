import {WorldReaction} from './types';
import {findAttackableEntity} from '@simulation/state';
import {tryGetDoor} from '@content/registry';

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

    // Неразрушаемая дверь не умирает, даже если её hp оказался ≤ 0
    // (урон по ней обнуляется в applyDamageToEntity, но hp мог быть 0 изначально).
    if (entity.type === 'door' && 'templateId' in entity && tryGetDoor(entity.templateId)?.indestructible === true) {
        return [];
    }

    const deathPos = { x: entity.x, y: entity.y };
    return [
        {
            type: 'DIE',
            entityId: entity.id,
            position: deathPos,
        },
    ];
};
