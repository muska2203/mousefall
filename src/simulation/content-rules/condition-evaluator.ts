/**
 * Оценщик декларативных условий контентных правил.
 *
 * Вынесен в отдельный модуль, чтобы использоваться как при реакциях
 * на события, так и при модификаторах интентов.
 */

import type {EntityId} from '@simulation/core-types.ts';
import {findEntity} from '@simulation/state.ts';
import {hasTag} from '@simulation/systems/tags/tag-helpers.ts';
import {rngChance} from '@utils/rng.ts';
import type {RuleContext} from './rule-context.ts';
import {resolveParametrizedValue} from './value-resolver.ts';
import type {RuleCondition} from './types.ts';

/**
 * Оценивает список условий. Пустой список считается истинным.
 */
export function evaluateConditions(
  conditions: RuleCondition[] | undefined,
  ctx: RuleContext,
  selfId: EntityId | null,
  candidateId?: EntityId,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, ctx, selfId, candidateId));
}

/**
 * Рекурсивно оценивает одно условие правила.
 */
export function evaluateCondition(
  condition: RuleCondition,
  ctx: RuleContext,
  selfId: EntityId | null,
  candidateId?: EntityId,
): boolean {
  switch (condition.type) {
    case 'chance': {
      const probability = resolveParametrizedValue(condition.probability, ctx);
      return rngChance(ctx.state.runtimeRng, probability);
    }
    case 'hasStatus': {
      const subjectId = resolveSubjectId(condition.subject, selfId, ctx, candidateId);
      if (subjectId === null) return false;
      return hasStatus(subjectId, condition.statusType, ctx);
    }
    case 'hasTag': {
      return hasTag(ctx.eventTags, condition.tag);
    }
    case 'inTileEffect': {
      if (ctx.tileEffectsAtEventPosition === null) return false;
      return ctx.tileEffectsAtEventPosition[condition.effectType] !== undefined;
    }
    case 'tileEffectHasStatus': {
      if (ctx.tileEffectsAtEventPosition === null) return false;
      const effect = ctx.tileEffectsAtEventPosition[condition.effectType];
      if (!effect) return false;
      return effect.statusEffects.some((status) => status.type === condition.statusType);
    }
    case 'eventFieldEquals': {
      const event = ctx.event as Record<string, unknown>;
      return event[condition.field] === condition.value;
    }
    case 'eventRole': {
      // Проверяем, находится ли владелец правила (self) на указанной стороне события.
      if (selfId === null) return false;
      if (condition.role === 'source') return selfId === ctx.sourceEntityId;
      if (condition.role === 'target') return selfId === ctx.targetEntityId;
      return false;
    }
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, ctx, selfId, candidateId));
    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, ctx, selfId, candidateId));
    case 'not':
      return !evaluateCondition(condition.condition, ctx, selfId, candidateId);
    default:
      return false;
  }
}

/**
 * Преобразует субъект условия (`self` / `target` / `candidate`) в EntityId.
 */
function resolveSubjectId(
  subject: 'self' | 'target' | 'candidate',
  selfId: EntityId | null,
  ctx: RuleContext,
  candidateId?: EntityId,
): EntityId | null {
  switch (subject) {
    case 'self':
      return selfId;
    case 'target':
      return ctx.targetEntityId;
    case 'candidate':
      return candidateId ?? null;
    default:
      return null;
  }
}

/**
 * Проверяет, есть ли у сущности указанный статус.
 */
function hasStatus(entityId: EntityId, statusType: string, ctx: RuleContext): boolean {
  const entity = findEntity(ctx.state, entityId);
  if (!entity || !('statusEffects' in entity)) return false;
  return entity.statusEffects.some((effect) => effect.type === statusType);
}
