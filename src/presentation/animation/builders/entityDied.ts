/**
 * Builder для события ENTITY_DIED.
 */

import type {AnimationBuilder} from '../core/registry';
import {deathNode} from '../core/primitives';

export const entityDiedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ENTITY_DIED') return null;

  return [deathNode(event, children)];
};
