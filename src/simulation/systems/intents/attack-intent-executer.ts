import {GameState} from '@simulation/types';
import {DamageIntent, IntentExecutor} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {findAttackableEntity} from '@simulation/state';
import {applyDamageToEntity} from '@simulation/systems/damage/apply-damage';

export const executeDamageIntent: IntentExecutor<DamageIntent> = (
  state: GameState,
  intent: DamageIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findAttackableEntity(state, intent.entityId);
  if (!target) return null;

  return applyDamageToEntity(
    state,
    target,
    intent.damage,
    intent.tags,
    intent.sourceEntityId,
    builder,
    parent,
  );
};
