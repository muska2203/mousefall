/**
 * Builder для события ABILITY_PREPARED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { abilityPreparedNode } from '../core/primitives';

export const abilityPreparedBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'ABILITY_PREPARED') return null;

  return [abilityPreparedNode(event)];
};
