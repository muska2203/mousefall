/**
 * Executor анимации отскока при столкновении (BOUNCE).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';

export class BounceAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'BOUNCE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'BOUNCE') return;

    await ctx.worldRenderer.animateBounce(
      step.entityId,
      step.x,
      step.y,
      step.dx,
      step.dy,
      ANIMATION_CONFIG.BOUNCE,
    );
  }
}
