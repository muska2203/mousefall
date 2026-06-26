import { GameState } from '@simulation/types';
import { RestoreApIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { findEntity } from '@simulation/state';

/**
 * Восстанавливает AP актора до максимума.
 *
 * Контракт:
 * - actor.ap устанавливается в actor.maxAp.
 * - Порождает событие AP_RESTORED.
 */
export const executeRestoreApIntent: IntentExecutor<RestoreApIntent> = (
  state: GameState,
  intent: RestoreApIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !('ap' in entity) || !('maxAp' in entity)) return null;

  const actor = entity as { ap: number; maxAp: number };
  const amount = actor.maxAp - actor.ap;
  actor.ap = actor.maxAp;

  return builder.addChild(parent, {
    type: 'AP_RESTORED',
    entityId: intent.entityId,
    amount,
    remaining: actor.ap,
  });
};
