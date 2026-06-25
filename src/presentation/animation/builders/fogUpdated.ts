/**
 * Builder для события FOG_UPDATED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { fogUpdateNode } from '../core/primitives';

export const fogUpdatedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'FOG_UPDATED') return null;

  return [fogUpdateNode(event, children)];
};
