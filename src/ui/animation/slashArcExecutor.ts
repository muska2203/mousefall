/**
 * Executor анимации дуги рассечения (SLASH_ARC).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {registerAnimationExecutor} from './registry';
import {runArc} from './primitives/arc';

export class SlashArcExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'SLASH_ARC';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'SLASH_ARC') return;

    const config = ANIMATION_CONFIG.SLASH_ARC;
    const fromX = step.from.x * TILE_SIZE + TILE_SIZE / 2;
    const fromY = step.from.y * TILE_SIZE + TILE_SIZE / 2;
    const radius = TILE_SIZE * Math.SQRT2;
    const color = 0xe74c3c;
    const lineWidth = TILE_SIZE / 3;

    const target = step.positions[1];
    if (!target) {
      return;
    }

    const midAngle = Math.atan2(
      target.y * TILE_SIZE + TILE_SIZE / 2 - fromY,
      target.x * TILE_SIZE + TILE_SIZE / 2 - fromX,
    );

    return runArc({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: config.duration,
      easing: config.easing,
      centerX: fromX,
      centerY: fromY,
      radius,
      startAngle: midAngle - Math.PI / 4,
      endAngle: midAngle + Math.PI / 4,
      lineWidth,
      color,
    });
  }
}

registerAnimationExecutor(new SlashArcExecutor());
