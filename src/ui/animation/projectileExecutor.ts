/**
 * Executor анимации полёта снаряда (PROJECTILE).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';

export class ProjectileAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'PROJECTILE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'PROJECTILE') return;

    const config = ANIMATION_CONFIG.PROJECTILE;
    await ctx.worldRenderer.animateProjectile(step.from, step.to, config, ctx.ticker);
  }
}
