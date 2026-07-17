/**
 * Builder для события ENTITY_DISPLACED.
 *
 * Отображает перемещение сущности так же, как обычное движение.
 * Если отталкивание уже породило MOVE-анимацию через реакцию мира
 * (displacement-move-reaction), не дублируем её собственным MOVE.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { displacementMoveNode } from '../core/primitives';

export const entityDisplacedBuilder: AnimationBuilder = (event, children, _state) => {
  if (event.type !== 'ENTITY_DISPLACED') return null;

  const hasMoveForEntity = children.some(
    (n) => n.step.type === 'MOVE' && n.step.entityId === event.entityId,
  );
  if (hasMoveForEntity) {
    // Патч ENTITY_DISPLACED прикрепится к дочерним корневым узлам в planner.
    return children;
  }

  return [displacementMoveNode(event, children)];
};
