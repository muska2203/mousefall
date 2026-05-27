/**
 * Executor спрайтовых анимаций (MOVE, ATTACK, DEATH).
 *
 * Делегирует в WorldRenderer, который управляет EntityRenderer и камерой.
 */

import type { AnimationExecutor, AnimationContext } from './types';
import type { AnimationStep } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';
import type { AnimationConfigKey } from '@utils/animationConfig';

export class SpriteAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'MOVE' || step.type === 'ATTACK' || step.type === 'DEATH' || step.type === 'ITEM_DROP';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    const wr = ctx.worldRenderer;

    switch (step.type) {
      case 'MOVE': {
        const isPlayer = step.entityId === ctx.playerId;
        await wr.animateMove(step.entityId, step.from, step.to, config, isPlayer);
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
