/**
 * Builder для события ACTION_APPLIED.
 */

import type {AnimationBuilder} from '../core/registry';
import {attackNode} from '../core/primitives';

export const actionAppliedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ACTION_APPLIED') return null;

  const node = attackNode(event, children);
  return node ? [node] : null;
};
