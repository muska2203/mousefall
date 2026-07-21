/**
 * Реакция контентных правил на игровые события.
 *
 * Собирает активные правила из всех слоёв (source, target, world, radius),
 * фильтрует их по триггеру, оценивает условия и превращает подходящие эффекты
 * в интенты для последующего исполнения.
 *
 * Модуль намеренно не импортирует `executeIntent` — это позволяет избежать
 * циклических зависимостей между системой правил и исполнителем интентов.
 */

import type {
    EntityId,
    ExecutionBuilder,
    ExecutionNode,
    GameEvent,
    GameplayTag,
    Intent,
    Position,
} from '@simulation/core-types.ts';
import type {Actor, GameState} from '@simulation/types.ts';
import {findEntity, getTileEffectsAt, isActor} from '@simulation/state.ts';
import {tryGetTileEffect} from '@content/registry';
import {hasAllTags} from '@simulation/systems/tags/tag-helpers.ts';
import {ensureRuntimeRng} from '../runtime-rng.ts';
import {getWorldContentRules} from '../rules.ts';
import {tryGetContentRule} from '../registry.ts';
import {buildRuleContext, type RuleContext} from '../rule-context.ts';
import {resolveParametrizedValue} from '../value-resolver.ts';
import {evaluateConditions} from '../condition-evaluator.ts';
import type {ActiveRule, ContentRule, OwnerContext, RuleEffect, TargetSelector,} from '../types.ts';

/** Слой происхождения правила. Определяет порядок обработки. */
type RuleLayer = 'source' | 'target' | 'world' | 'radius';

/** Правило вместе со слоем и ID сущности-владельца (`selfId`). */
type LayeredRule = {
  layer: RuleLayer;
  rule: ActiveRule;
  selfId: EntityId | null;
  /** Подтип слоя `world`: global → tileEffect → tileIntrinsic. */
  worldLayer?: 'global' | 'tileEffect' | 'tileIntrinsic';
};

/** Радиус слоя `radius` — Chebyshev distance от позиции события. */
const RADIUS_LAYER_RADIUS = 1;

/** Порядок слоёв: чем меньше число, тем раньше обрабатывается слой. */
const LAYER_ORDER: Record<RuleLayer, number> = {
  source: 0,
  target: 1,
  world: 2,
  radius: 3,
};

/** Порядок подтипов внутри слоя `world`: global → tileEffect → tileIntrinsic. */
const WORLD_LAYER_ORDER: Record<NonNullable<LayeredRule['worldLayer']>, number> = {
  global: 0,
  tileEffect: 1,
  tileIntrinsic: 2,
};

/**
 * Основная точка входа: возвращает интенты, порождённые контентными правилами,
 * в ответ на переданное событие.
 */
export function runContentRuleReactions(
  state: GameState,
  event: GameEvent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): Intent[] {
  ensureRuntimeRng(state);
  const ctx = buildRuleContext(state, event);
  const layeredRules = collectRules(ctx);
  const triggered = filterRulesByTrigger(layeredRules, event.type, ctx.eventTags);
  const ordered = sortRules(triggered);

  const intents: Intent[] = [];
  for (const { rule, selfId, layer } of ordered) {
    if (!evaluateConditions(rule.conditions, ctx, selfId)) continue;

    const targetIds = resolveTarget(rule.target, ctx, selfId).filter((candidateId) => {
      if (!rule.targetConditions) return true;
      return evaluateConditions(rule.targetConditions, ctx, selfId, candidateId);
    });

    if (targetIds.length === 0) continue;

    const ruleIntents = buildIntents(rule.effect, targetIds, ctx, selfId);
    intents.push(...ruleIntents);

    builder.addChild(parent, {
      type: 'RULE_TRIGGERED',
      ruleId: rule.id,
      layer,
      ownerEntityId: selfId,
      triggerEventType: event.type,
      triggerTags: ctx.eventTags,
      intents: ruleIntents,
      conditionMatched: true,
    });
  }

  return intents;
}

/**
 * Превращает статическое правило в активное с указанным контекстом владельца.
 */
function toActiveRule(rule: ContentRule, ownerContext: OwnerContext): ActiveRule {
  return { ...rule, ownerContext };
}

/**
 * Собирает активные правила по слоям.
 *
 * - source: activeRules сущности-источника события.
 * - target: activeRules сущности-цели события.
 * - world: все глобальные мировые правила.
 * - radius: activeRules живых акторов в радиусе от позиции события.
 */
function collectRules(ctx: RuleContext): LayeredRule[] {
  const result: LayeredRule[] = [];
  const { state } = ctx;

  // ── Слой source ───────────────────────────────────────────────────────────
  if (ctx.sourceEntityId !== null) {
    const entity = findEntity(state, ctx.sourceEntityId);
    if (entity && isActor(entity)) {
      for (const rule of entity.activeRules) {
        result.push({ layer: 'source', rule, selfId: ctx.sourceEntityId });
      }
    }
  }

  // ── Слой target ───────────────────────────────────────────────────────────
  // Если source и target совпадают, target-слой не дублируется.
  if (ctx.targetEntityId !== null && ctx.targetEntityId !== ctx.sourceEntityId) {
    const entity = findEntity(state, ctx.targetEntityId);
    if (entity && isActor(entity)) {
      for (const rule of entity.activeRules) {
        result.push({ layer: 'target', rule, selfId: ctx.targetEntityId });
      }
    }
  }

  // ── Слой world: tile effects ──────────────────────────────────────────────
  // Правила собираются из шаблонов эффектов, находящихся на позиции события.
  if (ctx.eventPosition !== null) {
    const tileEffects = getTileEffectsAt(state, ctx.eventPosition.x, ctx.eventPosition.y);
    for (const tileEffectType of Object.keys(tileEffects)) {
      const template = tryGetTileEffect(tileEffectType);
      if (!template) continue;
      for (const ruleId of template.ruleIds) {
        const rule = tryGetContentRule(ruleId);
        if (!rule) continue;
        result.push({
          layer: 'world',
          rule: toActiveRule(rule, { type: 'tileEffect', position: ctx.eventPosition, tileEffectType }),
          selfId: null,
          worldLayer: 'tileEffect',
        });
      }
    }
  }

  // ── Слой world: global / tileIntrinsic ────────────────────────────────────
  for (const rule of getWorldContentRules()) {
    result.push({
      layer: 'world',
      rule: toActiveRule(rule, { type: 'world' }),
      selfId: null,
      worldLayer: rule.worldLayer,
    });
  }

  // ── Слой radius ───────────────────────────────────────────────────────────
  // Исключает source и target, чтобы не дублировать их activeRules.
  if (ctx.eventPosition !== null) {
    const center = ctx.eventPosition;
    for (const entity of state.entities.values()) {
      if (!isActor(entity) || !entity.isAlive) continue;
      if (entity.id === ctx.sourceEntityId || entity.id === ctx.targetEntityId) continue;

      const dx = Math.abs(entity.x - center.x);
      const dy = Math.abs(entity.y - center.y);
      if (Math.max(dx, dy) <= RADIUS_LAYER_RADIUS) {
        for (const rule of entity.activeRules) {
          result.push({ layer: 'radius', rule, selfId: entity.id });
        }
      }
    }
  }

  return result;
}

/**
 * Оставляет только правила, чей триггер совпадает с типом события
 * и чьи обязательные теги содержатся в тегах события.
 */
function filterRulesByTrigger(
  rules: LayeredRule[],
  eventType: string,
  tags: GameplayTag[],
): LayeredRule[] {
  return rules.filter(({ rule }) => {
    if (rule.trigger.event !== eventType) return false;
    return !(rule.trigger.tags && !hasAllTags(tags, rule.trigger.tags));

  });
}

/**
 * Сортирует правила по слоям, затем по подтипу слоя `world`,
 * затем по приоритету, затем по id.
 */
function sortRules(rules: LayeredRule[]): LayeredRule[] {
  return [...rules].sort((a, b) => {
    const layerDiff = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
    if (layerDiff !== 0) return layerDiff;

    // Внутри слоя `world` фиксированный порядок: global → tileEffect → tileIntrinsic.
    if (a.layer === 'world' && b.layer === 'world') {
      const worldLayerDiff = WORLD_LAYER_ORDER[a.worldLayer!] - WORLD_LAYER_ORDER[b.worldLayer!];
      if (worldLayerDiff !== 0) return worldLayerDiff;
    }

    const priorityDiff = a.rule.priority - b.rule.priority;
    if (priorityDiff !== 0) return priorityDiff;

    return a.rule.id.localeCompare(b.rule.id);
  });
}

/**
 * Разрешает селектор цели в список ID сущностей.
 */
function resolveTarget(
  selector: TargetSelector,
  ctx: RuleContext,
  selfId: EntityId | null,
): EntityId[] {
  switch (selector.type) {
    case 'eventTarget':
      return ctx.targetEntityId !== null ? [ctx.targetEntityId] : [];
    case 'eventSource':
      return ctx.sourceEntityId !== null ? [ctx.sourceEntityId] : [];
    case 'self':
      return selfId !== null ? [selfId] : [];
    case 'collisionTarget':
      return ctx.collisionTargetId !== null ? [ctx.collisionTargetId] : [];
    case 'allInRadius':
      return resolveAllInRadius(selector, ctx, selfId);
    case 'nearestEnemy':
      return resolveNearestEnemy(selector, ctx, selfId);
    default:
      return [];
  }
}

/**
 * Возвращает всех акторов в заданном радиусе от центра.
 * Если указана фракция (`enemy` / `ally`), оставляет только акторов с подходящей
 * фракцией относительно сущности-владельца правила.
 * Мёртвые акторы исключаются. Результат отсортирован по `id` для детерминизма.
 */
function resolveAllInRadius(
  selector: Extract<TargetSelector, { type: 'allInRadius' }>,
  ctx: RuleContext,
  selfId: EntityId | null,
): EntityId[] {
  const center = resolveCenter(selector.center, ctx, selfId);
  if (!center) return [];

  const self = selfId !== null ? findEntity(ctx.state, selfId) : null;
  const selfFaction = (self as Actor | undefined)?.factionId;

  const result: EntityId[] = [];
  for (const entity of ctx.state.entities.values()) {
    if (!isActor(entity)) continue;
    const actor = entity as Actor;

    if (!actor.isAlive) continue;
    if (selector.excludeSelf === true && actor.id === selfId) continue;

    const dx = Math.abs(actor.x - center.x);
    const dy = Math.abs(actor.y - center.y);
    if (Math.max(dx, dy) > selector.radius) continue;

    if (selector.faction === 'ally' && actor.factionId !== selfFaction) continue;
    if (selector.faction === 'enemy' && actor.factionId === selfFaction) continue;

    result.push(actor.id);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

/**
 * Возвращает ближайшую враждебную сущность в заданном радиусе от центра.
 */
function resolveNearestEnemy(
  selector: Extract<TargetSelector, { type: 'nearestEnemy' }>,
  ctx: RuleContext,
  selfId: EntityId | null,
): EntityId[] {
  const center = resolveCenter(selector.center, ctx, selfId);
  if (!center) return [];

  const self = selfId !== null ? findEntity(ctx.state, selfId) : null;
  const selfFaction = (self as Actor | undefined)?.factionId;

  const candidates = Array.from(ctx.state.entities.values())
    .filter((entity) => isActor(entity))
    .map((entity) => entity as Actor)
    .filter((entity) => entity.factionId !== selfFaction)
    .map((entity) => ({
      id: entity.id,
      distance: Math.max(Math.abs(entity.x - center.x), Math.abs(entity.y - center.y)),
    }))
    .filter((item) => item.distance <= selector.radius)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));

  const first = candidates[0];
  if (first === undefined) return [];
  return [first.id];
}

/**
 * Определяет центр радиусного селектора.
 */
function resolveCenter(
  center: 'eventPosition' | 'self',
  ctx: RuleContext,
  selfId: EntityId | null,
): Position | null {
  if (center === 'eventPosition') return ctx.eventPosition;
  if (selfId === null) return null;

  const entity = findEntity(ctx.state, selfId);
  if (!entity) return null;
  return { x: entity.x, y: entity.y };
}

/**
 * Превращает эффект правила и список целей в готовые интенты.
 */
function buildIntents(
  effect: RuleEffect,
  targetIds: EntityId[],
  ctx: RuleContext,
  selfId: EntityId | null,
): Intent[] {
  switch (effect.type) {
    case 'applyStatus': {
      const duration = resolveParametrizedValue(effect.duration, ctx);
      return targetIds.map((entityId) => ({
        type: 'APPLY_STATUS',
        entityId,
        sourceEntityId: selfId ?? ctx.sourceEntityId,
        status: {
          type: effect.statusType,
          duration,
          value: effect.value ?? 0,
          statModifiers: null,
        },
      }));
    }
    case 'dealDamage': {
      const amount = resolveParametrizedValue(effect.amount, ctx);
      // Если теги не заданы явно, наследуем их из события (например, COUNTER_ATTACK_APPLIED
      // уже несёт рассчитанные теги урона).
      const tags = effect.tags ?? ctx.eventTags;
      return targetIds.map((entityId) => ({
        type: 'DAMAGE',
        entityId,
        // Для мировых правил selfId === null, поэтому сохраняем источника из контекста события.
        sourceEntityId: selfId ?? ctx.sourceEntityId,
        damage: amount,
        tags,
      }));
    }
    case 'heal': {
      const amount = resolveParametrizedValue(effect.amount, ctx);
      return targetIds.map((entityId) => ({
        type: 'HEAL',
        entityId,
        amount,
      }));
    }
    case 'restoreAp': {
      return targetIds.map((entityId) => ({
        type: 'RESTORE_AP',
        entityId,
      }));
    }
    case 'consumeAp': {
      const amount = resolveParametrizedValue(effect.amount, ctx);
      return targetIds.map((entityId) => ({
        type: 'CONSUME_AP',
        entityId,
        amount,
      }));
    }
    case 'modifyDamage':
      // В фазе 2 modifyDamage не порождает отдельных интентов;
      // обработка переносится на слой исполнения.
      return [];
    case 'counterAttack': {
      if (selfId === null) return [];
      const targetId = ctx.sourceEntityId;
      if (targetId === null) return [];

      const counterAttacker = findEntity(ctx.state, selfId);
      const target = findEntity(ctx.state, targetId);
      let dx = 0;
      let dy = 0;
      if (
        counterAttacker && target &&
        'x' in counterAttacker && 'y' in counterAttacker &&
        'x' in target && 'y' in target
      ) {
        dx = target.x - counterAttacker.x;
        dy = target.y - counterAttacker.y;
      }

      return [{
        type: 'COUNTER_ATTACK',
        counterAttackerId: selfId,
        targetId,
        dx,
        dy,
      }];
    }
    default:
      return [];
  }
}
