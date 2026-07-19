/**
 * Builder для события STATUS_APPLIED.
 */

import type {AnimationBuilder} from '../core/registry';
import {statusBurstForEntity} from '../core/primitives';

export const statusAppliedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'STATUS_APPLIED') return null;

  const entity = state.entities.get(event.entityId) ?? state.player;
  const node = statusBurstForEntity(
    event.entityId,
    entity,
    event.effect.type,
    children,
  );

  return node ? [node] : null;
};
