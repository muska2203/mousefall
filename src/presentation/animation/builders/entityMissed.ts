/**
 * Builder для события ENTITY_MISSED.
 *
 * Отображает всплывающий текст промаха у цели (или у атакующего, если цель не найдена).
 */

import type {AnimationBuilder} from '../core/registry';
import {floatingTextNode} from '../core/primitives';

export const entityMissedBuilder: AnimationBuilder = (event, _children, state) => {
  if (event.type !== 'ENTITY_MISSED') return null;

  const entity =
    state.entities.get(event.targetId) ??
    (state.player.id === event.targetId ? state.player : undefined) ??
    state.entities.get(event.attackerId) ??
    (state.player.id === event.attackerId ? state.player : undefined);
  if (!entity) return null;

  return [
    floatingTextNode(
      undefined,
      'system.animation.entityMissed',
      { x: entity.x, y: entity.y },
      'miss',
    ),
  ];
};
