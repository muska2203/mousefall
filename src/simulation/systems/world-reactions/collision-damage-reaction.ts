import { WorldReaction } from './types';
import { findEntity, isActor } from '@simulation/state';

/**
 * Базовый урон при столкновении отталкиваемого актора с препятствием или другим актором.
 */
const PUSH_BUMP_DAMAGE = 5;

import type { DamageType } from '@simulation/core-types';

/**
 * Тип урона при толчке.
 */
const PUSH_DAMAGE_TYPE: DamageType = 'blunt';

/**
 * Реакция мира: столкновение от толчка наносит урон отталкиваемому актору.
 * При столкновении с другим актором урон получают оба.
 */
export const collisionDamageReaction: WorldReaction = (state, event) => {
  if (event.type !== 'ENTITY_COLLIDED') return [];

  const pushed = findEntity(state, event.entityId);
  if (!pushed || !isActor(pushed) || !('hp' in pushed)) return [];

  const intents = [];

  intents.push({
    type: 'DAMAGE' as const,
    entityId: event.entityId,
    sourceEntityId: event.sourceEntityId,
    damage: PUSH_BUMP_DAMAGE,
    damageType: PUSH_DAMAGE_TYPE,
    tags: ['delivery.movement'],
  });

  if (event.collisionType === 'actor' && event.targetId) {
    const target = findEntity(state, event.targetId);
    if (target && isActor(target) && 'hp' in target) {
      intents.push({
        type: 'DAMAGE' as const,
        entityId: event.targetId,
        sourceEntityId: event.sourceEntityId,
        damage: PUSH_BUMP_DAMAGE,
        damageType: PUSH_DAMAGE_TYPE,
        tags: ['delivery.movement'],
      });
    }
  }

  return intents;
};
