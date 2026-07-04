/**
 * Реакция мира на события, заметные AI.
 *
 * Ответственность:
 * - Преобразовать доменное событие в WorldChange.
 * - Найти всех живых AI-акторов, потенциально способных воспринять изменение.
 * - Создать NOTIFY_AI интенты для каждого такого актора.
 *
 * Правила:
 * - Реакция НЕ проверяет FOV и LOS — это ответственность стратегии.
 *   Здесь только грубый фильтр по расстоянию (Chebyshev) для производительности.
 * - Актор не реагирует на собственное движение.
 */

import type { GameEvent, GameState } from '@simulation/types';
import type { Intent, WorldChange } from '@simulation/core-types';
import type { WorldReaction } from './types';
import { findAllAliveAiActors } from '@simulation/state';
import { chebyshevDistance } from '@utils/math';
import { getWorldChangePosition } from '@simulation/ai/perception-types';
import { isEnemyEntity } from '@simulation/ai/ai-state';

/**
 * Преобразует доменное событие в изменение мира, если оно интересно AI.
 */
function toWorldChange(event: GameEvent): WorldChange | null {
  switch (event.type) {
    case 'ENTITY_MOVED':
      return {
        kind: 'entity_moved',
        entityId: event.entityId,
        from: event.from,
        to: event.to,
      };
    case 'DOOR_OPENED':
      return { kind: 'door_opened', position: event.position };
    case 'DOOR_CLOSED':
      return { kind: 'door_closed', position: event.position };
    default:
      return null;
  }
}

export const aiPerceptionReaction: WorldReaction = (
  state: GameState,
  event: GameEvent,
): Intent[] => {
  const change = toWorldChange(event);
  if (!change) return [];

  const changePosition = getWorldChangePosition(change);
  const intents: Intent[] = [];

  for (const actor of findAllAliveAiActors(state)) {
    // Собственное движение не считается новой информацией.
    if (change.kind === 'entity_moved' && change.entityId === actor.id) {
      continue;
    }

    // Поддерживаем только врагов с радиусом зрения.
    if (!isEnemyEntity(actor)) {
      continue;
    }

    const distance = chebyshevDistance(
      { x: actor.x, y: actor.y },
      changePosition,
    );

    // Грубый фильтр: дальше радиуса зрения смысла уведомлять нет.
    if (distance > actor.aiSightRadius) {
      continue;
    }

    intents.push({
      type: 'NOTIFY_AI',
      entityId: actor.id,
      change,
    });
  }

  return intents;
};
