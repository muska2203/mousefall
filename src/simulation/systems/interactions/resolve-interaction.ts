/**
 * Разрешение доступного взаимодействия для интерактивных объектов.
 *
 * Контракт:
 * - По `interactionKind` сущности и её текущему состоянию вычисляется,
 *   какое действие будет выполнено при `INTERACT`.
 * - Стоимость AP не вычисляется здесь — она всегда 1 для `INTERACT`.
 */

import type { GameState, Entity, DoorEntity, StairsEntity, InteractionKind } from '@simulation/types';

/** Описание разрешённого взаимодействия. */
export type ResolvedInteraction = {
  /** Идентификатор взаимодействия, используемый Presentation для подсказок и i18n. */
  interactionId: string;
  /** true — действие доступно с соседней клетки; false — нужно стоять на той же клетке. */
  usableFromAdjacent: boolean;
};

/**
 * Возвращает разрешённое взаимодействие для целевой сущности от лица актора.
 * Если сущность не интерактивна или взаимодействие недоступно — возвращает null.
 */
export function resolveInteraction(
  _state: GameState,
  entity: Entity,
  _actor: Entity,
): ResolvedInteraction | null {
  if (!('interactionKind' in entity)) {
    return null;
  }

  const kind = entity.interactionKind as InteractionKind;

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
      const stairs = entity as StairsEntity;
      return stairs.templateId === 'stairs_up'
        ? { interactionId: 'ascend', usableFromAdjacent: false }
        : { interactionId: 'descend', usableFromAdjacent: false };
    }

    // 'item' и 'lever' будут добавлены в следующих блоках.
    default:
      return null;
  }
}
