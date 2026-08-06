/**
 * Executor анимации полёта снаряда (PROJECTILE).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {cellCenter} from '../renderer/spritePlacement';
import {registerAnimationExecutor} from './registry';
import {runTweenedGraphics} from './primitives/tweenedGraphics';

export class ProjectileAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'PROJECTILE';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'PROJECTILE') return;

    const config = ANIMATION_CONFIG.PROJECTILE;
    const fromCenter = cellCenter(step.from.x, step.from.y);
    const toCenter = cellCenter(step.to.x, step.to.y);
    const fromX = fromCenter.x;
    const fromY = step.fromSky
      ? (ctx.worldRenderer.cameraWorldPos?.y ?? 0) - TILE_SIZE
      : fromCenter.y;
    const toX = toCenter.x;
    const toY = toCenter.y;
    const radius = TILE_SIZE / 4;

    return new Promise((resolve) => {
      runTweenedGraphics({
        parent: ctx.worldRenderer.root,
        ticker: ctx.ticker,
        duration: config.duration,
        easing: config.easing,
        setup: (g) => {
          g.circle(0, 0, radius);
          g.fill({color: 0xff3300});
          g.x = fromX;
          g.y = fromY;
        },
        update: (g, p) => {
          g.x = fromX + (toX - fromX) * p;
          g.y = fromY + (toY - fromY) * p;
        },
        onComplete: resolve,
      });
    });
  }
}

registerAnimationExecutor(new ProjectileAnimationExecutor());
