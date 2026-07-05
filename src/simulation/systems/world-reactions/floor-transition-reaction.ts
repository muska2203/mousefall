/**
 * Реакция мира на событие FLOOR_CHANGED.
 *
 * Контракт:
 * - По событию `FLOOR_CHANGED` возвращает набор интентов, которые атомарно
 *   применяют план перехода к состоянию и порождают соответствующие события.
 * - Оркестровка sub-intent'ов разрешена здесь, так как это world reaction,
 *   а не IntentExecutor (см. docs/agents/ACTION_SYSTEM.md).
 */

import type { GameState, GameEvent } from '@simulation/types';
import type { Intent, FloorChangedEvent, FogUpdatedEvent } from '@simulation/core-types';
import type { WorldReaction } from './types';

export const floorTransitionReaction: WorldReaction = (
  _state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'FLOOR_CHANGED') {
    return [];
  }

  const plan = event.plan;
  const fovEvents = plan.fovEvents.filter(
    (e): e is FogUpdatedEvent => e.type === 'FOG_UPDATED',
  );

  return [
    { type: 'SET_MAP', map: plan.map, explored: plan.explored },
    { type: 'SET_ENTITIES', entities: plan.entities },
    {
      type: 'TELEPORT_ENTITY',
      entityId: 'player',
      x: plan.playerPosition.x,
      y: plan.playerPosition.y,
    },
    { type: 'BEGIN_TURN', side: 'player', round: plan.turn.round },
    { type: 'RESTORE_AP', entityId: 'player' },
    { type: 'APPLY_FOG_EVENTS', events: fovEvents },
  ];
};
