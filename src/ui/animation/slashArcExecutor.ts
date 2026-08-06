/**
 * Executor анимации дуги рассечения (SLASH_ARC).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {cellCenter} from '../renderer/spritePlacement';
import {registerAnimationExecutor} from './registry';
import {runArc} from './primitives/arc';

export class SlashArcExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'SLASH_ARC';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'SLASH_ARC') return;

    const config = ANIMATION_CONFIG.SLASH_ARC;
    const {x: fromX, y: fromY} = cellCenter(step.from.x, step.from.y);
    const radius = TILE_SIZE * Math.SQRT2;
    const color = 0xe74c3c;
    const lineWidth = TILE_SIZE / 3;

    const target = step.positions[1];
    if (!target) {
      return;
    }

    const targetCenter = cellCenter(target.x, target.y);
    const midAngle = Math.atan2(
      targetCenter.y - fromY,
      targetCenter.x - fromX,
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
