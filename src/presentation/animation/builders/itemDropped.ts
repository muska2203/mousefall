/**
 * Builder для события ITEM_DROPPED.
 */

import type {AnimationBuilder} from '../core/registry';
import {itemDropNode} from '../core/primitives';

export const itemDroppedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ITEM_DROPPED') return null;

  return [itemDropNode(event, children)];
};
