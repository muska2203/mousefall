import { GameState, StatusEffect } from '@simulation/types';
import { PushIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity, isBlocked, isActor, findAllEntitiesAt } from '@simulation/state';
import { executeDamage } from '@simulation/systems/damage/damage-processor';
import { executeApplyStatusIntent } from '@simulation/systems/intents/apply-status-intent-executer';

/**
 * Базовый урон при столкновении отталкиваемого актора с препятствием или другим актором.
 */
const PUSH_BUMP_DAMAGE = 5;

/**
 * Тип урона при толчке.
 */
const PUSH_DAMAGE_TYPE = 'blunt';

/**
 * Создаёт эффект оглушения длительностью 1 ход.
 */
function createStunEffect(): StatusEffect {
  return {
    type: 'stunned',
    duration: 1,
    value: 0,
    statModifiers: null,
  };
}

/**
 * Пытается наложить оглушение на сущность.
 * Оглушение применяется только к акторам, чтобы избежать зависших статусов на не-акторах
 * (дверях, предметах), которые никогда не делают ход и не тикают stunned.
 */
function tryApplyStun(
  state: GameState,
  entityId: string,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
  const target = findEntity(state, entityId);
  if (!target || !isActor(target)) return null;

  return executeApplyStatusIntent(
    state,
    { type: 'APPLY_STATUS', entityId, status: createStunEffect() },
    builder,
    parent,
  );
}

/**
 * Исполняет интент отталкивания PUSH.
 *
 * Логика:
 * - Свободная клетка → перемещение (ENTITY_MOVED).
 * - Стена / непроходимый не-актор → урон и оглушение отталкиваемому актору.
 * - Другой актор в целевой клетке → урон и оглушение обоим акторам.
 */
export const executePushIntent: IntentExecutor<PushIntent> = (
  state: GameState,
  intent: PushIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !isActor(entity)) return null;

  const targetX = entity.x + intent.dx;
  const targetY = entity.y + intent.dy;

  // За пределами карты или стена — столкновение с препятствием.
  if (
    targetX < 0 ||
    targetX >= state.map.width ||
    targetY < 0 ||
    targetY >= state.map.height ||
    state.map.tiles[targetY]?.[targetX] === 'wall'
  ) {
    const damageNode = executeDamage(state, entity.id, PUSH_BUMP_DAMAGE, PUSH_DAMAGE_TYPE, intent.sourceEntityId, builder, parent);
    if (damageNode) {
      builder.addChild(damageNode, {
        type: 'ENTITY_BUMPED',
        entityId: entity.id,
        position: { x: entity.x, y: entity.y },
        dx: intent.dx,
        dy: intent.dy,
      });
    }
    const stunNode = damageNode ? tryApplyStun(state, entity.id, builder, damageNode) : null;
    return stunNode ?? damageNode ?? null;
  }

  const entitiesAtTarget = findAllEntitiesAt(state, targetX, targetY).filter(e => e.id !== entity.id);
  const actorAtTarget = entitiesAtTarget.find(e => isActor(e) && 'hp' in e && e.isAlive !== false);

  // Столкновение с другим актором.
  if (actorAtTarget) {
    let lastNode: ExecutionNode | null = null;

    const pushedDamageNode = executeDamage(state, entity.id, PUSH_BUMP_DAMAGE, PUSH_DAMAGE_TYPE, intent.sourceEntityId, builder, parent);
    if (pushedDamageNode) {
      lastNode = pushedDamageNode;
      builder.addChild(pushedDamageNode, {
        type: 'ENTITY_BUMPED',
        entityId: entity.id,
        position: { x: entity.x, y: entity.y },
        dx: intent.dx,
        dy: intent.dy,
      });
    }

    const pushedStunNode = lastNode ? tryApplyStun(state, entity.id, builder, lastNode) : null;
    if (pushedStunNode) lastNode = pushedStunNode;

    const targetDamageNode = executeDamage(state, actorAtTarget.id, PUSH_BUMP_DAMAGE, PUSH_DAMAGE_TYPE, intent.sourceEntityId, builder, parent);
    if (targetDamageNode) {
      lastNode = targetDamageNode;
      builder.addChild(targetDamageNode, {
        type: 'ENTITY_BUMPED',
        entityId: actorAtTarget.id,
        position: { x: actorAtTarget.x, y: actorAtTarget.y },
        dx: intent.dx,
        dy: intent.dy,
      });
    }

    const targetStunNode = lastNode ? tryApplyStun(state, actorAtTarget.id, builder, lastNode) : null;
    if (targetStunNode) lastNode = targetStunNode;

    return lastNode;
  }

  // Столкновение с непроходимым не-актором (например, закрытой дверью при пуше).
  if (entitiesAtTarget.some(e => e.blocksMovement) || isBlocked(state, targetX, targetY)) {
    const damageNode = executeDamage(state, entity.id, PUSH_BUMP_DAMAGE, PUSH_DAMAGE_TYPE, intent.sourceEntityId, builder, parent);
    if (damageNode) {
      builder.addChild(damageNode, {
        type: 'ENTITY_BUMPED',
        entityId: entity.id,
        position: { x: entity.x, y: entity.y },
        dx: intent.dx,
        dy: intent.dy,
      });
    }
    const stunNode = damageNode ? tryApplyStun(state, entity.id, builder, damageNode) : null;
    return stunNode ?? damageNode ?? null;
  }

  // Свободная клетка — перемещение.
  const from = { x: entity.x, y: entity.y };
  entity.x = targetX;
  entity.y = targetY;
  const to = { x: targetX, y: targetY };

  return builder.addChild(parent, {
    type: 'ENTITY_MOVED',
    entityId: intent.entityId,
    from,
    to,
  });
};
