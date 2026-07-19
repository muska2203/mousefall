/**
 * Builder для события ABILITY_PREPARED_CANCELLED.
 */

import type {AnimationBuilder} from '../core/registry';
import {abilityPreparedCancelledNode} from '../core/primitives';

export const abilityPreparedCancelledBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'ABILITY_PREPARED_CANCELLED') return null;

  return [abilityPreparedCancelledNode(event)];
};
