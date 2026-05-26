/**
 * Executor анимации взрыва (EXPLOSION).
 */

import type { AnimationExecutor, AnimationContext } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';

export class ExplosionAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'EXPLOSION';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'EXPLOSION') return;

    const config = ANIMATION_CONFIG.EXPLOSION;
    await ctx.worldRenderer.animateExplosion(step.center, config, ctx.ticker);
  }
}
