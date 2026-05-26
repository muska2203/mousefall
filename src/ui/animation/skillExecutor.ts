/**
 * Executor анимаций способностей (ABILITY_CAST).
 *
 * Правила:
 * - Выполняет пульсацию кастера.
 * - Специфичные визуальные эффекты (снаряд, взрыв) разворачиваются
 *   в animationPlanner.ts в шаги PROJECTILE / EXPLOSION.
 */

import type { AnimationExecutor, AnimationContext } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';

export class SkillAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'ABILITY_CAST';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'ABILITY_CAST') return;

    const castConfig = ANIMATION_CONFIG.ABILITY_CAST;
    await ctx.worldRenderer.animateAbilityCast(step.entityId, castConfig);
  }
}
