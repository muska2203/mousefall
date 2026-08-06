/**
 * Executor анимации луча (BEAM).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {cellCenter} from '../renderer/spritePlacement';
import {registerAnimationExecutor} from './registry';
import {runBeam} from './primitives/beam';

export class BeamAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'BEAM';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'BEAM') return;

    const config = ANIMATION_CONFIG.BEAM;
    const {x: fromX, y: fromY} = cellCenter(step.from.x, step.from.y);
    const {x: toX, y: toY} = cellCenter(step.to.x, step.to.y);

    return runBeam({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: config.duration,
      easing: config.easing,
      fromX,
      fromY,
      toX,
      toY,
      color: step.color,
      lineWidth: TILE_SIZE / 4,
      fadeOut: true,
    });
  }
}

registerAnimationExecutor(new BeamAnimationExecutor());
