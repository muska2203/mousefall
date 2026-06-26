import { GameState } from '@simulation/types';
import { TickCastIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { findEntity } from '@simulation/state';

/**
 * Уменьшает оставшиеся ходы подготовленного каста актора на 1.
 *
 * Контракт:
 * - activeCast.remainingTurns уменьшается на 1, но не ниже 0.
 * - Порождает событие CAST_TICKED.
 */
export const executeTickCastIntent: IntentExecutor<TickCastIntent> = (
  state: GameState,
  intent: TickCastIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !('activeCast' in entity)) return null;

  const actor = entity as { activeCast: { abilityId: string; remainingTurns: number } | null };
  if (!actor.activeCast) return null;

  actor.activeCast.remainingTurns = Math.max(0, actor.activeCast.remainingTurns - 1);

  return builder.addChild(parent, {
    type: 'CAST_TICKED',
    entityId: intent.entityId,
    abilityId: actor.activeCast.abilityId,
    remainingTurns: actor.activeCast.remainingTurns,
  });
};
