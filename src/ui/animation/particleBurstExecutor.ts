/**
 * Executor универсальной вспышки частиц (PARTICLE_BURST).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {cellCenter} from '../renderer/spritePlacement';
import {registerAnimationExecutor} from './registry';
import {runParticleBurst} from './primitives/particleBurst';

export class ParticleBurstAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'PARTICLE_BURST';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'PARTICLE_BURST') return;

    const config = ANIMATION_CONFIG.PARTICLE_BURST;
    const {x: centerX, y: centerY} = cellCenter(step.x, step.y);
    return runParticleBurst({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: config.duration,
      easing: config.easing,
      centerX,
      centerY,
      color: step.color,
      count: step.count,
    });
  }
}

registerAnimationExecutor(new ParticleBurstAnimationExecutor());
