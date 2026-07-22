import type {Entity, EntityId, GameState, Attackable} from '@simulation/types';
import type {GameplayTag} from '@simulation/core-types';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {DamageCalculationContext, getDamageHandler} from '@simulation/systems/damage/damage-handlers';

/** Подсчитывает теги урона (начинающиеся с "damage."). */
function countDamageTags(tags: readonly string[]): number {
  return tags.filter((tag) => tag === 'damage' || tag.startsWith('damage.')).length;
}

/**
 * Наносит урон сущности, эмитит ENTITY_DAMAGED и возвращает узел события.
 *
 * Общая логика для точечного (DAMAGE) и площадного (DAMAGE_TILE) урона.
 * Предполагается, что target уже проверен на isAlive и наличие hp вызывающей стороной.
 */
export function applyDamageToEntity(
  state: GameState,
  target: Entity & Attackable,
  rawDamage: number,
  tags: GameplayTag[],
  sourceEntityId: EntityId | null,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode {
  const damageTagCount = countDamageTags(tags);
  if (damageTagCount === 0) {
    // eslint-disable-next-line no-console
    console.warn('[applyDamageToEntity] damage has no damage tag.', { target: target.id, tags });
  } else if (damageTagCount > 1) {
    // eslint-disable-next-line no-console
    console.warn('[applyDamageToEntity] damage has multiple damage tags, expected exactly one.', { target: target.id, tags });
  }

  const handler = getDamageHandler(tags);
  const ctx: DamageCalculationContext = {
    rawDamage,
    sourceEntityId,
    target,
    tags,
  };

  const finalDamage = handler.calculateDamage(ctx);
  target.hp -= finalDamage;

  return builder.addChild(parent, {
    type: 'ENTITY_DAMAGED',
    damage: finalDamage,
    targetId: target.id,
    sourceEntityId,
    position: { x: target.x, y: target.y },
    tags,
  });
}
