/**
 * Executor дрожания клеток (TILE_SHAKE).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {registerAnimationExecutor} from './registry';

export class TileShakeExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'TILE_SHAKE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'TILE_SHAKE') return;
    const config = ANIMATION_CONFIG.TILE_SHAKE;
    await ctx.worldRenderer.animateTileShake(step.center, step.radius, config, ctx.ticker);
  }
}

registerAnimationExecutor(new TileShakeExecutor());
