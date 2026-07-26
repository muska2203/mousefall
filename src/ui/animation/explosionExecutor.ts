/**
 * Executor анимации взрыва (EXPLOSION).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {lerp} from '@utils/tween';
import {registerAnimationExecutor} from './registry';
import {runTweenedGraphics} from './primitives/tweenedGraphics';

export class ExplosionAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'EXPLOSION';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'EXPLOSION') return;

    const config = ANIMATION_CONFIG.EXPLOSION;
    const centerX = step.center.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = step.center.y * TILE_SIZE + TILE_SIZE / 2;
    const baseRadius = TILE_SIZE / 2;

    return new Promise((resolve) => {
      runTweenedGraphics({
        parent: ctx.worldRenderer.root,
        ticker: ctx.ticker,
        duration: config.duration,
        easing: config.easing,
        setup: (g) => {
          g.circle(0, 0, baseRadius);
          g.fill({color: 0xff3300, alpha: 0.8});
          g.x = centerX;
          g.y = centerY;
        },
        update: (g, p) => {
          g.scale.set(lerp(1, 2.5, p));
          g.alpha = lerp(0.8, 0, p);
        },
        onComplete: resolve,
      });
    });
  }
}

registerAnimationExecutor(new ExplosionAnimationExecutor());
