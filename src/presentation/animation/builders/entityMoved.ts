/**
 * Builder для события ENTITY_MOVED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { moveNode, jumpNode } from '../core/primitives';

export const entityMovedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ENTITY_MOVED') return null;

  // Телепорт (например, при смене этажа) не анимируем — позиция меняется мгновенно.
  if (event.movementType === 'teleport') {
    return null;
  }

  const stepType = event.movementType === 'jump' ? 'JUMP' : 'MOVE';
  if (stepType === 'JUMP') {
    return [jumpNode(event, children)];
  }

  return [moveNode(event, children)];
};
