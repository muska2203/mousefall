/**
 * Builder для события STATUS_BLOCKED.
 *
 * Отображает короткое всплывающее предупреждение о блокировке статуса.
 */

import type {AnimationBuilder} from '../core/registry';
import {floatingTextNode} from '../core/primitives';

export const statusBlockedBuilder: AnimationBuilder = (event, _children, state) => {
  if (event.type !== 'STATUS_BLOCKED') return null;

  const entity =
    state.entities.get(event.entityId) ??
    (state.player.id === event.entityId ? state.player : undefined);
  if (!entity) return null;

  return [
    floatingTextNode(
      undefined,
      'system.animation.statusBlocked',
      { x: entity.x, y: entity.y },
      'warning',
    ),
  ];
};
