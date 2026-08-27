import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, RestoreApIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {findEntity, isActor} from '@simulation/state';
import {getEffectiveMaxAp} from '@simulation/systems/stats/effective-stats';

/**
 * Восстанавливает AP актора.
 *
 * Контракт:
 * - Без `amount` — actor.ap устанавливается в эффективный maxAp (с учётом модификаторов
 *   статусов, например штрафа `dazed` из шаблона статуса).
 * - С `amount` — actor.ap увеличивается на amount с клампом к эффективному maxAp.
 * - Порождает событие AP_RESTORED (amount — фактическая дельта).
 */
export const executeRestoreApIntent: IntentExecutor<RestoreApIntent> = (
  state: GameState,
  intent: RestoreApIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !isActor(entity)) return null;

  // Все акторы (игрок и враги) являются StatActor — берём эффективный maxAp.
  const effectiveMaxAp = getEffectiveMaxAp(entity);

  const oldAp = entity.ap;
  entity.ap = intent.amount !== undefined
    ? Math.min(effectiveMaxAp, entity.ap + Math.max(0, Math.round(intent.amount)))
    : effectiveMaxAp;

  return builder.addChild(parent, {
    type: 'AP_RESTORED', isFieldEvent: false,
    entityId: intent.entityId,
    amount: entity.ap - oldAp,
    remaining: entity.ap,
  });
};
