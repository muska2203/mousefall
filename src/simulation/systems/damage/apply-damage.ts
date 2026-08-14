import type {Attackable, Entity, EntityId, GameState} from '@simulation/types';
import type {GameplayTag} from '@simulation/core-types';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {DamageCalculationContext, getDamageHandler} from '@simulation/systems/damage/damage-handlers';
import {isBulwarked} from '@simulation/systems/bulwark-helper';
import {tryGetDoor} from '@content/registry';

/** Подсчитывает теги урона (начинающиеся с "damage."). */
function countDamageTags(tags: readonly string[]): number {
  return tags.filter((tag) => tag === 'damage' || tag.startsWith('damage.')).length;
}

/** true, если цель — дверь с неразрушаемым шаблоном (`indestructible` в контенте). */
function isIndestructibleDoor(target: Entity & Attackable): boolean {
  if (target.type !== 'door' || !('templateId' in target)) return false;
  return tryGetDoor(target.templateId)?.indestructible === true;
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
  }
  // Несколько damage.*-тегов — легитимное состояние (например, правило реликвии
  // relic_salamander_heart добавляет огненную «школу» к физическому урону оружия);
  // обработчик выбирается первым подходящим предикатом в getDamageHandler.

  const handler = getDamageHandler(tags);
  const ctx: DamageCalculationContext = {
    rawDamage,
    sourceEntityId,
    target,
    tags,
  };

  // «Глухая оборона» (bulwark) обнуляет любой урон по носителю. Событие ENTITY_DAMAGED
  // с damage 0 всё равно эмитится: статусы (dazed, burning и т.п.) накладываются как обычно.
  // Аналогично неразрушаемая дверь (indestructible в шаблоне) обнуляет любой урон.
  const finalDamage = isBulwarked(target) || isIndestructibleDoor(target) ? 0 : handler.calculateDamage(ctx);
  target.hp -= finalDamage;

  return builder.addChild(parent, {
    type: 'ENTITY_DAMAGED', isFieldEvent: true,
    damage: finalDamage,
    targetId: target.id,
    sourceEntityId,
    position: { x: target.x, y: target.y },
    tags,
  });
}
