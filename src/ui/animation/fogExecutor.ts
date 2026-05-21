/**
 * Executor анимации тумана войны.
 *
 * Пока только задержка (placeholder); визуальная анимация открытия тайлов — TODO.
 */

import type { AnimationExecutor } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';
import { runTweenPromise } from '@utils/tween';

export class FogAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'FOG_UPDATE';
  }

  async execute(step: AnimationStep): Promise<void> {
    if (step.type !== 'FOG_UPDATE') return;
    const config = ANIMATION_CONFIG.FOG_UPDATE;
    await runTweenPromise({
      duration: config.duration,
      easing: config.easing,
      onUpdate: () => {
        // TODO: реализовать плавное открытие тайлов в FogRenderer
      },
    });
  }
}
