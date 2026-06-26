import { WorldReaction } from './types';
import { findEntity, isBlocked } from '@simulation/state';

/**
 * Реакция мира: успешное отталкивание на свободную клетку приводит к перемещению.
 * Порождает MOVE-интент, который исполнится через канонический executeIntent.
 */
export const displacementMoveReaction: WorldReaction = (state, event) => {
  if (event.type !== 'ENTITY_DISPLACED') return [];

  const entity = findEntity(state, event.entityId);
  if (!entity) return [];

  // Защитная проверка: целевая клетка должна быть свободна.
  // Если что-то изменилось с момента создания события — не перемещаем.
  if (isBlocked(state, event.to.x, event.to.y)) return [];

  return [{
    type: 'MOVE',
    entityId: event.entityId,
    dx: event.dx,
    dy: event.dy,
  }];
};
