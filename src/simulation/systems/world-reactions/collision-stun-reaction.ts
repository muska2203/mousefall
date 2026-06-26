import { WorldReaction } from './types';
import { findEntity, isActor } from '@simulation/state';

/**
 * Создаёт эффект оглушения длительностью 1 ход.
 */
function createStunEffect() {
  return {
    type: 'stunned' as const,
    duration: 1,
    value: 0,
    statModifiers: null,
  };
}

/**
 * Реакция мира: столкновение от толчка оглушает отталкиваемого актора.
 * При столкновении с другим актором оглушение получают оба.
 * Оглушение применяется только к акторам, чтобы избежать зависших статусов на не-акторах.
 */
export const collisionStunReaction: WorldReaction = (state, event) => {
  if (event.type !== 'ENTITY_COLLIDED') return [];

  const pushed = findEntity(state, event.entityId);
  if (!pushed || !isActor(pushed)) return [];

  const intents = [];

  intents.push({
    type: 'APPLY_STATUS' as const,
    entityId: event.entityId,
    status: createStunEffect(),
  });

  if (event.collisionType === 'actor' && event.targetId) {
    const target = findEntity(state, event.targetId);
    if (target && isActor(target)) {
      intents.push({
        type: 'APPLY_STATUS' as const,
        entityId: event.targetId,
        status: createStunEffect(),
      });
    }
  }

  return intents;
};
