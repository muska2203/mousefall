/**
 * Builder для события STATUS_STACKS_ADJUSTED.
 */

import type {AnimationBuilder} from '../core/registry';
import {statusBurstForEntity} from '../core/primitives';

export const statusStacksAdjustedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'STATUS_STACKS_ADJUSTED') return null;

  const entity = state.entities.get(event.entityId) ?? state.player;
  const node = statusBurstForEntity(
    event.entityId,
    entity,
    event.statusType,
    children,
  );

  return node ? [node] : null;
};
