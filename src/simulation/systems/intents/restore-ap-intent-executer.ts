import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, RestoreApIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {findEntity} from '@simulation/state';

/**
 * Восстанавливает AP актора до максимума.
 *
 * Контракт:
 * - actor.ap устанавливается в actor.maxAp.
 * - Если актор имеет статус `dazed`, восстановление снижается на 1, но не ниже 0.
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

  const actor = entity as { ap: number; maxAp: number; statusEffects?: Array<{ type: string }> };
  const hasDazed = actor.statusEffects?.some((effect) => effect.type === 'dazed') ?? false;

  // dazed снижает восстановление AP на 1, но не ниже 0.
  const oldAp = actor.ap;
  const restoredAp = hasDazed ? Math.max(0, actor.maxAp - 1) : actor.maxAp;
  actor.ap = restoredAp;

  return builder.addChild(parent, {
    type: 'AP_RESTORED',
    entityId: intent.entityId,
    amount: restoredAp - oldAp,
    remaining: actor.ap,
  });
};
