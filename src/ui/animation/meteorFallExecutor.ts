/**
 * Executor анимации падения метеорита (METEOR_FALL).
 *
 * Метеорит стартует за верхней границей viewport и падает на целевой тайл
 * с ускорением. По достижении цели проигрывается вспышка частиц.
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {Easing, lerp} from '@utils/tween';
import {registerAnimationExecutor} from './registry';
import {runTweenedGraphics} from './primitives/tweenedGraphics';
import {runParticleBurst} from './primitives/particleBurst';

/** Радиус метеорита. */
const METEOR_RADIUS = TILE_SIZE / 2;
/** Цвет вспышки при ударе. */
const IMPACT_COLOR = 0xff4400;

export class MeteorFallAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'METEOR_FALL';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'METEOR_FALL') return;

    const config = ANIMATION_CONFIG.METEOR_FALL;
    const toX = step.to.x * TILE_SIZE + TILE_SIZE / 2;
    const toY = step.to.y * TILE_HEIGHT + TILE_HEIGHT / 2;
    const cameraWorldPos = ctx.worldRenderer.cameraWorldPos;
    // Стартуем за верхней границей viewport. Если камера ещё не инициализирована —
    // используем точку далеко над целью.
    const startY = cameraWorldPos ? cameraWorldPos.y - TILE_SIZE * 2 : toY - TILE_SIZE * 6;
    const startX = toX + (step.from.x - step.to.x) * TILE_SIZE;

    await new Promise<void>((resolve) => {
      runTweenedGraphics({
        parent: ctx.worldRenderer.root,
        ticker: ctx.ticker,
        duration: config.duration,
        easing: Easing.easeInQuad,
        setup: (g) => {
          g.circle(0, 0, METEOR_RADIUS);
          g.fill({color: step.color, alpha: 0.9});
          g.x = startX;
          g.y = startY;
        },
        update: (g, p) => {
          g.x = lerp(startX, toX, p);
          g.y = lerp(startY, toY, p);
          g.scale.set(lerp(1, 0.7, p));
        },
        onComplete: resolve,
      });
    });

    // Вспышка частиц при ударе.
    await runParticleBurst({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: 250,
      easing: Easing.easeOutQuad,
      centerX: toX,
      centerY: toY,
      color: IMPACT_COLOR,
      count: 12,
      particleRadius: 4,
      minSpeed: TILE_SIZE * 0.2,
      maxSpeed: TILE_SIZE * 0.7,
    });
  }
}

registerAnimationExecutor(new MeteorFallAnimationExecutor());
