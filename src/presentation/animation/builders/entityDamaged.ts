/**
 * Builder для события ENTITY_DAMAGED.
 */

import type { GameEvent, GameState } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { damageNode, hpChangeNode, isAttackableEntity } from '../core/primitives';

export const entityDamagedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;

  // Полоска HP анимируется только для не-игрока и только если у цели есть HP.
  // Оборачиваем исходных детей (например, смерть) в HP_CHANGE,
  // который выполняется после всплывающего текста урона и перед смертью.
  // Это предотвращает уничтожение спрайта во время анимации полоски HP.
  if (event.targetId !== state.player.id && event.damage > 0) {
    const target = state.entities.get(event.targetId);
    if (target && isAttackableEntity(target)) {
      const toHp = target.hp;
      const fromHp = toHp + event.damage;
      if (fromHp !== toHp) {
        return [
          damageNode(event, [
            hpChangeNode(event, target, children),
          ]),
        ];
      }
    }
  }

  return [damageNode(event, children)];
};
