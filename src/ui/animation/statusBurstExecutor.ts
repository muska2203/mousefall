import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';

export class StatusBurstAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'STATUS_BURST';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'STATUS_BURST') return;
    const config = ANIMATION_CONFIG.STATUS_BURST;
    await ctx.worldRenderer.animateStatusBurst(step.position, step.statusType, config, ctx.ticker);
  }
}
