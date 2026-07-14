/**
 * Построитель контекста правил `RuleContext`.
 *
 * По событию или интенту собирает единый контекст для передачи в декларативные
 * контентные правила. Правила не работают с сырым событием напрямую.
 */

import type { GameState } from '@simulation/types.ts';
import { findAllEntitiesAt, findEntity } from '@simulation/state.ts';
import type {
  EntityId,
  GameEvent,
  GameplayTag,
  Intent,
  Position,
} from '@simulation/core-types.ts';

/**
 * Контекст правила, передаваемый в условия и эффекты.
 */
export type RuleContext = {
  state: GameState;
  event: GameEvent | Intent;

  sourceEntityId: EntityId | null;
  targetEntityId: EntityId | null;

  /** Только для ENTITY_COLLIDED: сущность, с которой произошло столкновение. */
  collisionTargetId: EntityId | null;
  /** Только для ABILITY_USED: позиция первой цели/точки применения способности. */
  abilityTargetPosition: Position | null;
  /** Только для ABILITY_USED: ID сущностей, находящихся в точках targets. */
  abilityTargets: EntityId[] | null;

  eventPosition: Position | null;
  eventTags: GameplayTag[];

  eventDamage: number | null;
  eventAmount: number | null;
  eventDuration: number | null;
  eventStacks: number | null;
  eventMaxHp: number | null;
};

/**
 * Возвращает текущую позицию сущности по ID или null, если сущность не найдена.
 */
function getEntityPosition(state: GameState, entityId: EntityId | null): Position | null {
  if (entityId === null) return null;
  const entity = findEntity(state, entityId);
  if (entity === undefined) return null;
  return { x: entity.x, y: entity.y };
}

/**
 * Извлекает массив тегов из поля `tags` события/интента.
 * Если поле отсутствует — возвращает пустой массив.
 */
function getEventTags(event: GameEvent | Intent): GameplayTag[] {
  if ('tags' in event && Array.isArray(event.tags)) {
    return event.tags;
  }
  return [];
}

/**
 * Строит RuleContext по состоянию и событию/интенту.
 */
export function buildRuleContext(state: GameState, event: GameEvent | Intent): RuleContext {
  const base: RuleContext = {
    state,
    event,
    sourceEntityId: null,
    targetEntityId: null,
    collisionTargetId: null,
    abilityTargetPosition: null,
    abilityTargets: null,
    eventPosition: null,
    eventTags: getEventTags(event),
    eventDamage: null,
    eventAmount: null,
    eventDuration: null,
    eventStacks: null,
    eventMaxHp: null,
  };

  switch (event.type) {
    case 'ENTITY_DAMAGED': {
      base.sourceEntityId = event.sourceEntityId;
      base.targetEntityId = event.targetId;
      base.eventPosition = event.position;
      base.eventDamage = event.damage;
      break;
    }

    case 'ENTITY_HEALED': {
      base.targetEntityId = event.entityId;
      base.eventPosition = event.position;
      base.eventAmount = event.amount;
      break;
    }

    case 'ENTITY_COLLIDED': {
      base.sourceEntityId = event.sourceEntityId;
      base.targetEntityId = event.entityId;
      base.collisionTargetId = event.targetId;
      base.eventPosition = event.position;
      break;
    }

    case 'STATUS_APPLIED': {
      base.sourceEntityId = event.sourceEntityId ?? null;
      base.targetEntityId = event.entityId;
      base.eventDuration = event.effect.duration;
      break;
    }

    case 'STATUS_REMOVED': {
      base.targetEntityId = event.entityId;
      break;
    }

    case 'STATUS_STACKS_ADJUSTED': {
      base.targetEntityId = event.entityId;
      base.eventStacks = event.stacks;
      break;
    }

    case 'RESOURCE_CONSUMED': {
      base.sourceEntityId = event.entityId;
      base.eventAmount = event.amount;
      break;
    }

    case 'ENTITY_DISPLACED': {
      base.sourceEntityId = event.sourceEntityId;
      base.targetEntityId = event.entityId;
      base.eventPosition = event.to;
      break;
    }

    case 'COUNTER_ATTACK_APPLIED': {
      base.sourceEntityId = event.attackerId;
      base.targetEntityId = event.targetId;
      break;
    }

    case 'ENTITY_MOVED': {
      base.sourceEntityId = event.entityId;
      base.eventPosition = event.to;
      break;
    }

    case 'STATUS_TICKED': {
      base.targetEntityId = event.entityId;
      base.eventTags = event.tags;

      const entity = findEntity(state, event.entityId);
      base.eventMaxHp = entity && 'maxHp' in entity ? (entity.maxHp as number) : null;
      break;
    }

    case 'ABILITY_USED': {
      base.sourceEntityId = event.entityId;
      const targets = event.targets;
      const firstTarget = targets[0];

      if (firstTarget !== undefined) {
        base.abilityTargetPosition = firstTarget;
        base.abilityTargets = targets
          .flatMap((pos) => findAllEntitiesAt(state, pos.x, pos.y).map((e) => e.id));
        const firstEntities = findAllEntitiesAt(state, firstTarget.x, firstTarget.y);
        const firstEntity = firstEntities[0];
        base.targetEntityId = firstEntity !== undefined ? firstEntity.id : null;
        base.eventPosition = firstTarget;
      }
      break;
    }

    case 'TURN_BEGAN': {
      base.sourceEntityId = event.actorId;
      break;
    }

    case 'AP_RESTORED': {
      base.sourceEntityId = event.entityId;
      base.eventAmount = event.amount;
      break;
    }

    case 'DAMAGE': {
      base.sourceEntityId = event.sourceEntityId;
      base.targetEntityId = event.entityId;
      base.eventDamage = event.damage;
      break;
    }

    case 'PUSH': {
      base.sourceEntityId = event.sourceEntityId;
      base.targetEntityId = event.entityId;
      break;
    }

    case 'APPLY_STATUS': {
      base.sourceEntityId = event.sourceEntityId ?? null;
      base.targetEntityId = event.entityId;
      break;
    }

    case 'MOVE': {
      base.targetEntityId = event.entityId;
      break;
    }

    case 'HEAL': {
      base.targetEntityId = event.entityId;
      base.eventAmount = event.amount;
      break;
    }

    default: {
      // Неподдерживаемые события/интенты оставляют базовый контекст с тегами.
      break;
    }
  }

  // Fallback для eventPosition:
  // собственная позиция события ?? targetEntityId ?? sourceEntityId ?? collisionTargetId ?? null.
  base.eventPosition =
    base.eventPosition
    ?? getEntityPosition(state, base.targetEntityId)
    ?? getEntityPosition(state, base.sourceEntityId)
    ?? getEntityPosition(state, base.collisionTargetId);

  return base;
}
