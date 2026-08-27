import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, RestoreApIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {findEntity, isActor} from '@simulation/state';
import {getEffectiveMaxAp} from '@simulation/systems/stats/effective-stats';

/**
 * Восстанавливает AP актора до максимума.
 *
 * Контракт:
 * - actor.ap устанавливается в эффективный maxAp (с учётом модификаторов
 *   статусов, например штрафа `dazed` из шаблона статуса).
 * - Порождает событие AP_RESTORED.
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
  const restoredAp = getEffectiveMaxAp(entity);

  const oldAp = entity.ap;
  entity.ap = restoredAp;

  return builder.addChild(parent, {
    type: 'AP_RESTORED', isFieldEvent: false,
    entityId: intent.entityId,
    amount: restoredAp - oldAp,
    remaining: entity.ap,
  });
};
