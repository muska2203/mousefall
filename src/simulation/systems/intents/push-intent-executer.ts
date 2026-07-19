import {GameState} from '@simulation/types';
import {IntentExecutor, PushIntent} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode, GameplayTag} from '@simulation/core-types';
import {findAllEntitiesAt, findEntity, isActor, isBlocked} from '@simulation/state';

/**
 * Формирует теги события столкновения без дублирования.
 *
 * Всегда добавляет `displacement.push` и тег типа столкновения.
 * Учитывает дополнительные теги, переданные через интент.
 */
function buildCollisionTags(
  intent: PushIntent,
  collisionType: 'wall' | 'actor' | 'blocking-object',
): GameplayTag[] {
  return [...new Set([...(intent.tags ?? []), 'displacement.push', `collision.${collisionType}`])];
}

/**
 * Исполняет интент отталкивания PUSH.
 *
 * Контракт:
 * - PUSH-исполнитель не исполняет другие интенты напрямую.
 * - Он определяет результат толчка и порождает семантическое событие:
 *   - ENTITY_DISPLACED — если актор переместился на свободную клетку.
 *   - ENTITY_COLLIDED — если актор столкнулся со стеной, другим актором
 *     или непроходимым объектом.
 * - Мировые реакции на эти события порождают DAMAGE, APPLY_STATUS, MOVE и т.д.
 */
export const executePushIntent: IntentExecutor<PushIntent> = (
  state: GameState,
  intent: PushIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !isActor(entity)) return null;

  const from = { x: entity.x, y: entity.y };
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
    return builder.addChild(parent, {
      type: 'ENTITY_COLLIDED',
      entityId: entity.id,
      targetId: null,
      collisionType: 'wall',
      sourceEntityId: intent.sourceEntityId,
      position: from,
      dx: intent.dx,
      dy: intent.dy,
      tags: buildCollisionTags(intent, 'wall'),
    });
  }

  const entitiesAtTarget = findAllEntitiesAt(state, targetX, targetY).filter(e => e.id !== entity.id);
  const actorAtTarget = entitiesAtTarget.find(e => isActor(e) && 'hp' in e && e.isAlive);

  // Столкновение с другим актором.
  if (actorAtTarget) {
    return builder.addChild(parent, {
      type: 'ENTITY_COLLIDED',
      entityId: entity.id,
      targetId: actorAtTarget.id,
      collisionType: 'actor',
      sourceEntityId: intent.sourceEntityId,
      position: from,
      dx: intent.dx,
      dy: intent.dy,
      tags: buildCollisionTags(intent, 'actor'),
    });
  }

  // Столкновение с непроходимым не-актором (например, закрытой дверью при пуше).
  if (entitiesAtTarget.some(e => e.blocksMovement) || isBlocked(state, targetX, targetY)) {
    return builder.addChild(parent, {
      type: 'ENTITY_COLLIDED',
      entityId: entity.id,
      targetId: null,
      collisionType: 'blocking-object',
      sourceEntityId: intent.sourceEntityId,
      position: from,
      dx: intent.dx,
      dy: intent.dy,
      tags: buildCollisionTags(intent, 'blocking-object'),
    });
  }

  // Свободная клетка — актор будет перемещён реакцией на ENTITY_DISPLACED.
  return builder.addChild(parent, {
    type: 'ENTITY_DISPLACED',
    entityId: intent.entityId,
    sourceEntityId: intent.sourceEntityId,
    from,
    to: { x: targetX, y: targetY },
    dx: intent.dx,
    dy: intent.dy,
  });
};
