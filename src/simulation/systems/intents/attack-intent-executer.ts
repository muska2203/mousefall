import { GameState } from '@simulation/types';
import { DamageIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findAttackableEntity } from '@simulation/state';
import { getDamageTypeHandler, DamageCalculationContext } from '@simulation/systems/damage/damage-type-handlers';

export const executeDamageIntent: IntentExecutor<DamageIntent> = (
  state: GameState,
  intent: DamageIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findAttackableEntity(state, intent.entityId);
  if (!target) return null;

  const handler = getDamageTypeHandler(intent.damageType);
  const ctx: DamageCalculationContext = {
    rawDamage: intent.damage,
    damageType: intent.damageType,
    sourceEntityId: intent.sourceEntityId,
    target,
  };

  const finalDamage = handler.calculateDamage(ctx);
  target.hp -= finalDamage;

  return builder.addChild(parent, {
    type: 'ENTITY_DAMAGED',
    damage: finalDamage,
    damageType: intent.damageType,
    targetId: target.id,
    sourceEntityId: intent.sourceEntityId,
    position: { x: target.x, y: target.y },
    tags: intent.tags,
  });
};
