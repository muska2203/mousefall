/**
 * Реакция мира: горящее масло взрывается при наложении статуса burning.
 *
 * Срабатывает только при первом наложении статуса (isNew === true),
 * чтобы не взрываться повторно при обновлении длительности.
 * Масло не удаляется — оно продолжает гореть и распространяться.
 */

import type {GameEvent, GameState, Intent} from '@simulation/types.ts';
import type {WorldReaction} from '@simulation/systems/world-reactions/types.ts';

/** Урон взрыва горящего масла. */
const BURNING_OIL_EXPLOSION_DAMAGE = 2;

/** Радиус взрыва горящего масла. */
const BURNING_OIL_EXPLOSION_RADIUS = 1;

export const burningOilExplosionReaction: WorldReaction = (
  _state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'TILE_EFFECT_STATUS_APPLIED') {
    return [];
  }

  if (event.effectType !== 'oil' || event.statusType !== 'burning') {
    return [];
  }

  if (!event.isNew) {
    return [];
  }

  return [{
    type: 'TILE_EXPLOSION',
    position: event.position,
    sourceEntityId: null,
    damage: BURNING_OIL_EXPLOSION_DAMAGE,
    radius: BURNING_OIL_EXPLOSION_RADIUS,
    tags: ['damage.magical.fire'],
  }];
};
