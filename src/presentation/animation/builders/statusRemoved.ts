/**
 * Builder для события STATUS_REMOVED.
 *
 * Отображает короткое всплывающее уведомление о снятии статуса.
 */

import type { GameEvent, GameState } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { floatingTextNode } from '../core/primitives';

export const statusRemovedBuilder: AnimationBuilder = (event, _children, state) => {
  if (event.type !== 'STATUS_REMOVED') return null;

  const entity =
    state.entities.get(event.entityId) ??
    (state.player.id === event.entityId ? state.player : undefined);
  if (!entity) return null;

  return [
    floatingTextNode(
      undefined,
      'system.animation.statusRemoved',
      { x: entity.x, y: entity.y },
      'info',
    ),
  ];
};
