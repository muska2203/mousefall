/**
 * Builder для события ENTITY_BUMPED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { bounceNode } from '../core/primitives';

export const entityBumpedBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'ENTITY_BUMPED') return null;

  return [bounceNode(event)];
};
