/**
 * Executor универсальной вспышки частиц (PARTICLE_BURST).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {registerAnimationExecutor} from './registry';
import {runParticleBurst} from './primitives/particleBurst';

export class ParticleBurstAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'PARTICLE_BURST';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'PARTICLE_BURST') return;

    const config = ANIMATION_CONFIG.PARTICLE_BURST;
    return runParticleBurst({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: config.duration,
      easing: config.easing,
      centerX: step.x * TILE_SIZE + TILE_SIZE / 2,
      centerY: step.y * TILE_HEIGHT + TILE_HEIGHT / 2,
      color: step.color,
      count: step.count,
    });
  }
}

registerAnimationExecutor(new ParticleBurstAnimationExecutor());
