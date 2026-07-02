/**
 * Разрешение доступного взаимодействия для интерактивных объектов.
 *
 * Контракт:
 * - По `interactionKind` сущности и её текущему состоянию вычисляется,
 *   какое действие будет выполнено при `INTERACT`.
 * - Стоимость AP не вычисляется здесь — она всегда 1 для `INTERACT`.
 */

import type { GameState, Entity, DoorEntity, EntityInteractionKind, ResolvedInteraction } from '@simulation/types';

/**
 * Возвращает разрешённое взаимодействие для целевой сущности от лица актора.
 * Если сущность не интерактивна или взаимодействие недоступно — возвращает null.
 */
export function resolveInteraction(
  _state: GameState,
  entity: Entity,
  _actor: Entity,
): ResolvedInteraction | null {
  return resolveInteractionForEntity(entity);
}

/**
 * Чистая функция разрешения взаимодействия.
 * Не зависит от GameState, чтобы её можно было вынести в публичный API Simulation.
 */
export function resolveInteractionForEntity(
  entity: Entity,
): ResolvedInteraction | null {
  if (!('interactionKind' in entity)) {
    return null;
  }

  const kind = entity.interactionKind as EntityInteractionKind;

  switch (kind) {
    case 'door': {
      const door = entity as DoorEntity;
      // Разрушенная дверь не предоставляет взаимодействий.
      if (door.isAlive === false) {
        return null;
      }
      return door.isOpen
        ? { interactionId: 'close_door', usableFromAdjacent: true }
        : { interactionId: 'open_door', usableFromAdjacent: true };
    }

    case 'stairs': {
      if (entity.type !== 'stairs') {
        return null;
      }
      return entity.direction === 'up'
        ? { interactionId: 'ascend', usableFromAdjacent: false }
        : { interactionId: 'descend', usableFromAdjacent: false };
    }

    case 'item':
      return { interactionId: 'pickup', usableFromAdjacent: false };

    // 'lever' будет добавлен в следующих блоках.
    default:
      return null;
  }
}
