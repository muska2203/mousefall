/**
 * Animation builders для событий тайловых эффектов.
 */

import type {AnimationBuilder} from '../core/registry';
import {particleBurstNode} from '../core/primitives';
import type {Position} from '@simulation/core-types.ts';

function burstAt(position: Position, color: number, children: ReturnType<AnimationBuilder> = []): ReturnType<AnimationBuilder> {
  if (!children || children.length === 0) {
    return [particleBurstNode(position, color, 8)];
  }
  // Частицы и дочерние анимации (например, взрыв горящего масла) идут параллельно.
  return [particleBurstNode(position, color, 8), ...children];
}

export const tileEffectChangedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_CHANGED') return null;
  return burstAt(event.position, 0xcccccc, children);
};

export const tileEffectRemovedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_REMOVED') return null;
  return burstAt(event.position, 0x888888, children);
};

/** Цвет вспышки при наложении любого статуса на тайловый эффект. */
const TILE_EFFECT_STATUS_APPLIED_COLOR = 0xffaa00;

export const tileEffectStatusAppliedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_APPLIED') return null;
  return burstAt(event.position, TILE_EFFECT_STATUS_APPLIED_COLOR, children);
};

export const tileEffectStatusRemovedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_REMOVED') return null;
  return burstAt(event.position, 0x888888, children);
};
