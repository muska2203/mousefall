/**
 * Builder для события TILE_EXPLODED.
 *
 * Показывает площадной взрыв в точке детонации, аналогичный взрыву Fireball.
 * Дочерние анимации (урон по сущностям) проигрываются внутри взрыва.
 */

import type {AnimationBuilder} from '../core/registry';
import {explosionNode} from '../core/primitives';

export const tileExplodedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EXPLODED') return null;

  return [explosionNode(event.position, event.radius, children)];
};
