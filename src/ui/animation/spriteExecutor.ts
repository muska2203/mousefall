/**
 * Executor спрайтовых анимаций (MOVE, ATTACK, DEATH).
 *
 * Делегирует в WorldRenderer, который управляет EntityRenderer и камерой.
 */

import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep} from '@presentation/types';
import type {AnimationConfigKey} from '@utils/animationConfig';
import {ANIMATION_CONFIG} from '@utils/animationConfig';

export class SpriteAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'MOVE' || step.type === 'JUMP' || step.type === 'ATTACK' || step.type === 'DEATH' || step.type === 'ITEM_DROP';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    const wr = ctx.worldRenderer;

    switch (step.type) {
      case 'MOVE': {
        const isPlayer = step.entityId === ctx.playerId;
        const moveConfig = step.duration !== undefined ? { ...config, duration: step.duration } : config;
        await wr.animateMove(step.entityId, step.from, step.to, moveConfig, isPlayer, step.sway);
        break;
      }
      case 'JUMP': {
        await wr.animateJump(step.entityId, step.from, step.to, config);
        break;
      }
      case 'ATTACK': {
        await wr.animateAttack(step.attackerId, step.dx, step.dy, config);
        break;
      }
      case 'DEATH': {
        await wr.animateDeath(step.entityId, config);
        break;
      }
      case 'ITEM_DROP': {
        await wr.animateItemDrop(step.itemId, step.from, step.position, config);
        break;
      }
      default:
        break;
    }
  }
}
