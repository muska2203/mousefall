/**
 * Builder для события DOOR_OPENED.
 */

import type {AnimationBuilder} from '../core/registry';
import {doorOpenedNode} from '../core/primitives';

export const doorOpenedBuilder: AnimationBuilder = (event) => {
  if (event.type !== 'DOOR_OPENED') return null;

  return [doorOpenedNode(event)];
};
