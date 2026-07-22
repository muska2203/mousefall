/**
 * Animation builders для событий тайловых эффектов.
 */

import type {AnimationBuilder} from '../core/registry';
import {particleBurstNode} from '../core/primitives';
import type {Position} from '@simulation/core-types.ts';

function burstAt(position: Position, color: number): ReturnType<AnimationBuilder> {
  return [particleBurstNode(position, color, 8)];
}

export const tileEffectChangedBuilder: AnimationBuilder = (event, _children, _state) => {
  if (event.type !== 'TILE_EFFECT_CHANGED') return null;
  return burstAt(event.position, 0xcccccc);
};

export const tileEffectRemovedBuilder: AnimationBuilder = (event, _children, _state) => {
  if (event.type !== 'TILE_EFFECT_REMOVED') return null;
  return burstAt(event.position, 0x888888);
};

export const tileEffectStatusAppliedBuilder: AnimationBuilder = (event, _children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_APPLIED') return null;
  // Оранжево-жёлтый для горения, серый для остальных.
  const color = event.statusType === 'burning' ? 0xffaa00 : 0xcccccc;
  return burstAt(event.position, color);
};

export const tileEffectStatusRemovedBuilder: AnimationBuilder = (event, _children, _state) => {
  if (event.type !== 'TILE_EFFECT_STATUS_REMOVED') return null;
  return burstAt(event.position, 0x888888);
};
