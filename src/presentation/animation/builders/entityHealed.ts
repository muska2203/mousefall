/**
 * Builder для события ENTITY_HEALED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { healNode } from '../core/primitives';

export const entityHealedBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'ENTITY_HEALED') return null;

  return [healNode(event)];
};
