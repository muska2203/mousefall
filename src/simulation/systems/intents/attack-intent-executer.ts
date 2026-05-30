import { GameState } from '@simulation/types';
import { DamageIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { executeDamage } from '@simulation/systems/damage/damage-processor';

export const executeDamageIntent: IntentExecutor<DamageIntent> = (
  state: GameState,
  intent: DamageIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  return executeDamage(
    state,
    intent.entityId,
    intent.damage,
    intent.damageType,
    intent.sourceEntityId,
    builder,
    parent,
  );
};
