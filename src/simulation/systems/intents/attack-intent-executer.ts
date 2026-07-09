import { GameState } from '@simulation/types';
import { DamageIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findAttackableEntity } from '@simulation/state';
import { getDamageHandler, DamageCalculationContext } from '@simulation/systems/damage/damage-handlers';

/** Подсчитывает теги урона (начинающиеся с "damage."). */
function countDamageTags(tags: readonly string[]): number {
  return tags.filter((tag) => tag === 'damage' || tag.startsWith('damage.')).length;
}

export const executeDamageIntent: IntentExecutor<DamageIntent> = (
  state: GameState,
  intent: DamageIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findAttackableEntity(state, intent.entityId);
  if (!target) return null;

  const damageTagCount = countDamageTags(intent.tags);
  if (damageTagCount === 0) {
    console.warn('[executeDamageIntent] DAMAGE intent has no damage tag.', intent);
  } else if (damageTagCount > 1) {
    console.warn('[executeDamageIntent] DAMAGE intent has multiple damage tags, expected exactly one.', intent);
  }

  const handler = getDamageHandler(intent.tags);
  const ctx: DamageCalculationContext = {
    rawDamage: intent.damage,
    sourceEntityId: intent.sourceEntityId,
    target,
    tags: intent.tags,
  };

  const finalDamage = handler.calculateDamage(ctx);
  target.hp -= finalDamage;

  return builder.addChild(parent, {
    type: 'ENTITY_DAMAGED',
    damage: finalDamage,
    targetId: target.id,
    sourceEntityId: intent.sourceEntityId,
    position: { x: target.x, y: target.y },
    tags: intent.tags,
  });
};
