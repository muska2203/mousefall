/**
 * Реакция мира: свежее масло воспламеняется, если оно появилось
 * в соседней клетке от уже горящего масла.
 *
 * Проверяет 8 соседних клеток (Chebyshev distance = 1).
 * Поджог происходит только при первичном появлении масла (isNew === true).
 */

import type {GameEvent, GameState, Intent} from '@simulation/types.ts';
import type {WorldReaction} from '@simulation/systems/world-reactions/types.ts';
import {getTileEffectsAt} from '@simulation/state.ts';

/** Длительность горения, передаваемая при автоматическом поджоге. */
const IGNITION_DURATION = 3;

export const oilIgnitionNearBurningReaction: WorldReaction = (
  state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'TILE_EFFECT_CHANGED') {
    return [];
  }

  if (event.effectType !== 'oil' || !event.isNew) {
    return [];
  }

  const { x, y } = event.position;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const neighborEffects = getTileEffectsAt(state, x + dx, y + dy);
      const oil = neighborEffects['oil'];
      if (oil && oil.statusEffects.some((status) => status.type === 'burning')) {
        return [{
          type: 'APPLY_TILE_EFFECT_STATUS',
          effectType: 'oil',
          statusType: 'burning',
          position: { x, y },
          duration: IGNITION_DURATION,
          sourceEntityId: null,
        }];
      }
    }
  }

  return [];
};
