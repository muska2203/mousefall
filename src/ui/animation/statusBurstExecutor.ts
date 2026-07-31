/**
 * Executor вспышки статус-эффекта (STATUS_BURST).
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {registerAnimationExecutor} from './registry';
import {runParticleBurst} from './primitives/particleBurst';

/** Цвета частиц для известных статус-эффектов. */
const STATUS_COLORS: Record<string, number> = {
  burning: 0xff4400,
  poisoned: 0x44ff44,
  frozen: 0x88ddff,
  stunned: 0xffff00,
  regenerating: 0x44ff88,
  ticked: 0xffaa00,
};

export class StatusBurstAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'STATUS_BURST';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'STATUS_BURST') return;

    const config = ANIMATION_CONFIG.STATUS_BURST;
    const color = STATUS_COLORS[step.statusType] ?? 0xffffff;

    return runParticleBurst({
      parent: ctx.worldRenderer.root,
      ticker: ctx.ticker,
      duration: config.duration,
      easing: config.easing,
      centerX: step.position.x * TILE_SIZE + TILE_SIZE / 2,
      centerY: step.position.y * TILE_HEIGHT + TILE_HEIGHT / 2,
      color,
      count: 6,
    });
  }
}

registerAnimationExecutor(new StatusBurstAnimationExecutor());
