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

export const tileEffectStatusAppliedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_APPLIED') return null;
  // Оранжево-жёлтый для горения, серый для остальных.
  const color = event.statusType === 'burning' ? 0xffaa00 : 0xcccccc;
  return burstAt(event.position, color, children);
};

export const tileEffectStatusRemovedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_REMOVED') return null;
  return burstAt(event.position, 0x888888, children);
};
