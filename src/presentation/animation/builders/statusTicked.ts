/**
 * Builder для события STATUS_TICKED.
 */

import type { GameEvent, GameState } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { statusBurstForEntity } from '../core/primitives';

export const statusTickedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'STATUS_TICKED') return null;

  const entity = state.entities.get(event.entityId) ?? state.player;
  const node = statusBurstForEntity(
    event.entityId,
    entity,
    'ticked',
    children,
  );

  return node ? [node] : null;
};
