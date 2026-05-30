import { GameState } from '@simulation/types';
import { DamageType, ExecutionBuilder, ExecutionNode, EntityId } from '@simulation/core-types';
import { findAttackableEntity } from '@simulation/state';
import { getDamageTypeHandler, DamageCalculationContext } from './damage-type-handlers';

/**
 * Применяет урон к цели с учётом типа урона и модификаторов.
 * Мутирует HP цели и добавляет ENTITY_DAMAGED в дерево событий.
 */
export function executeDamage(
  state: GameState,
  targetId: EntityId,
  rawDamage: number,
  damageType: DamageType,
  sourceEntityId: EntityId | null,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
  const target = findAttackableEntity(state, targetId);
  if (!target) return null;

  const handler = getDamageTypeHandler(damageType);
  const ctx: DamageCalculationContext = {
    rawDamage,
    damageType,
    sourceEntityId,
    target,
  };

  const finalDamage = handler.calculateDamage(ctx);
  target.hp -= finalDamage;

  return builder.addChild(parent, {
    type: 'ENTITY_DAMAGED',
    damage: finalDamage,
    damageType,
    targetId: target.id,
    position: { x: target.x, y: target.y },
  });
}
