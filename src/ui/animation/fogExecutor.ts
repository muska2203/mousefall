/**
 * Executor анимации тумана войны.
 *
 * Пока только задержка (placeholder); визуальная анимация открытия тайлов — TODO.
 */

import type { AnimationExecutor, AnimationContext } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';

export class FogAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'FOG_UPDATE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'FOG_UPDATE') return;
    const config = ANIMATION_CONFIG.FOG_UPDATE;
    await ctx.worldRenderer.animateFogReveal(step.newlyVisible, config, ctx.ticker);
  }
}
