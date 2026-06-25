/**
 * Builder для события DOOR_CLOSED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { doorClosedNode } from '../core/primitives';

export const doorClosedBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'DOOR_CLOSED') return null;

  return [doorClosedNode(event)];
};
