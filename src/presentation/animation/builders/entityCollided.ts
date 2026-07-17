/**
 * Builder для события ENTITY_COLLIDED.
 *
 * Показывает тряску тайлов и всплеск частиц в точке столкновения.
 */

import type { GameEvent, GameState } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { particleBurstNode, tileShakeNode } from '../core/primitives';

/** Цвет частиц по умолчанию для столкновений. */
const DEFAULT_COLLISION_COLOR = 0xffaa00;

export const entityCollidedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'ENTITY_COLLIDED') return null;

  const position = { x: event.position.x, y: event.position.y };

  return [
    tileShakeNode(position, 1, children),
    particleBurstNode(position, DEFAULT_COLLISION_COLOR, 8, []),
  ];
};
