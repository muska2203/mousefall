/**
 * Builder для события CAST_CANCELLED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { castCancelledNode } from '../core/primitives';

export const castCancelledBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'CAST_CANCELLED') return null;

  return [castCancelledNode(event)];
};
