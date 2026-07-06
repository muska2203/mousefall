/**
 * Builder для события COUNTER_ATTACK_APPLIED.
 *
 * Создаёт полноценный шаг анимации ATTACK для ответного удара,
 * чтобы на UI проигрывалась анимация замаха оружием.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';

export const counterAttackAppliedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'COUNTER_ATTACK_APPLIED') return null;

  return [{
    step: {
      type: 'ATTACK',
      attackerId: event.attackerId,
      dx: event.dx,
      dy: event.dy,
    },
    children,
  }];
};
