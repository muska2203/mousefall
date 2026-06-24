/**
 * Executor анимации изменения HP (HP_CHANGE).
 *
 * Правила:
 * - Делегирует в EntityRenderer через WorldRenderer.
 * - Анимирует полоску HP от fromHp к toHp одновременно с всплывающим текстом урона.
 */

import type { AnimationExecutor, AnimationContext } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';
import type { AnimationConfigKey } from '@utils/animationConfig';

export class HpChangeAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'HP_CHANGE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'HP_CHANGE') return;
    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    await ctx.worldRenderer.animateHpChange(step.entityId, step.fromHp, step.toHp, step.maxHp, config);
  }
}
