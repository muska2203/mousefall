/**
 * Executor анимации дуги рассечения (SLASH_ARC).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';

export class SlashArcExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'SLASH_ARC';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'SLASH_ARC') return;

    const config = ANIMATION_CONFIG.SLASH_ARC;
    await ctx.worldRenderer.animateSlashArc(step.from, step.positions, config, ctx.ticker);
  }
}
