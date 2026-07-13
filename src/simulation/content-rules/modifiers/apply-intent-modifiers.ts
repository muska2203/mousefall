/**
 * Применение модифицирующих контентных правил к интенту.
 *
 * Ответственность:
 * - собирать активные правила с эффектом `modifyDamage` из слоёв source/target/world/radius;
 * - фильтровать их по триггеру и тегам интента;
 * - сортировать и применять модификаторы к урону DAMAGE-интента;
 * - возвращать новый интент, не мутируя входной объект и не трогая state.
 *
 * Модуль намеренно не импортирует `executeIntent` — подключение к исполнителю
 * выполняется на следующем шаге (Агент D).
 */

import type { GameState } from '@simulation/types.ts';
import type { EntityId, Intent } from '@simulation/core-types.ts';
import { findEntity, isActor } from '@simulation/state.ts';
import { hasAllTags, mergeDamageIntentTags } from '@simulation/systems/tags/tag-helpers.ts';
import { chebyshevDistance } from '@utils/math.ts';
import { getWorldContentRules } from '../rules.ts';
import type { RuleContext } from '../rule-context.ts';
import type { ActiveRule, ParametrizedValue } from '../types.ts';

/** Слой происхождения правила-модификатора. */
type RuleLayer = 'source' | 'target' | 'world' | 'radius';

/** Правило-модификатор вместе со слоем и ID сущности-владельца (`selfId`). */
type LayeredRule = {
  layer: RuleLayer;
  rule: ActiveRule;
  selfId: EntityId | null;
};

/** Радиус слоя `radius` — расстояние Чебышёва от позиции события. */
const RADIUS_LAYER_RADIUS = 1;

/** Порядок обработки слоёв: чем меньше число, тем раньше слой. */
const LAYER_ORDER: Record<RuleLayer, number> = {
  source: 0,
  target: 1,
  world: 2,
  radius: 3,
};

/** Порядок операторов внутри слоя: сначала умножение, затем сложение. */
const OP_ORDER: Record<'multiply' | 'add', number> = {
  multiply: 0,
  add: 1,
};

/**
 * Применяет ко DAMAGE-интенту модификаторы урона из всех слоёв.
 * Для остальных типов интентов возвращает исходный объект без изменений.
 */
export function applyIntentModifiers(
  state: GameState,
  intent: Intent,
  ctx: RuleContext,
): Intent {
  if (intent.type !== 'DAMAGE') {
    return intent;
  }

  const damageIntent = intent as Extract<Intent, { type: 'DAMAGE' }>;

  const layeredRules = collectDamageModifiers(state, ctx);
  const triggered = filterModifiersByTrigger(layeredRules, damageIntent);
  const ordered = sortModifiers(triggered);

  let damage = damageIntent.damage;
  let tags = damageIntent.tags;

  for (const { rule } of ordered) {
    const effect = rule.effect;
    if (effect.type !== 'modifyDamage') {
      continue;
    }

    const value = resolveParametrizedValue(effect.value, ctx);

    if (effect.op === 'multiply') {
      damage *= value;
    } else if (effect.op === 'add') {
      damage += value;
    }

    if (effect.addTags && effect.addTags.length > 0) {
      tags = mergeDamageIntentTags(tags, effect.addTags);
    }
  }

  return {
    ...intent,
    damage,
    tags,
  };
}

/**
 * Собирает активные правила-модификаторы по слоям.
 *
 * - source: activeRules сущности-источника интента.
 * - target: activeRules сущности-цели интента.
 * - world: глобальные мировые правила с `worldLayer: 'global'`.
 * - radius: activeRules живых акторов в радиусе 1 от позиции события, кроме source/target.
 */
function collectDamageModifiers(state: GameState, ctx: RuleContext): LayeredRule[] {
  const result: LayeredRule[] = [];

  // ── Слой source ───────────────────────────────────────────────────────────
  if (ctx.sourceEntityId !== null) {
    const entity = findEntity(state, ctx.sourceEntityId);
    if (entity && isActor(entity)) {
      for (const rule of entity.activeRules) {
        if (rule.effect.type === 'modifyDamage') {
          result.push({ layer: 'source', rule, selfId: ctx.sourceEntityId });
        }
      }
    }
  }

  // ── Слой target ───────────────────────────────────────────────────────────
  // Если source и target совпадают, target-слой не дублируется.
  if (ctx.targetEntityId !== null && ctx.targetEntityId !== ctx.sourceEntityId) {
    const entity = findEntity(state, ctx.targetEntityId);
    if (entity && isActor(entity)) {
      for (const rule of entity.activeRules) {
        if (rule.effect.type === 'modifyDamage') {
          result.push({ layer: 'target', rule, selfId: ctx.targetEntityId });
        }
      }
    }
  }

  // ── Слой world ────────────────────────────────────────────────────────────
  for (const rule of getWorldContentRules()) {
    if (rule.worldLayer === 'global' && rule.effect.type === 'modifyDamage') {
      result.push({
        layer: 'world',
        rule: rule as ActiveRule,
        selfId: null,
      });
    }
  }

  // ── Слой radius ───────────────────────────────────────────────────────────
  if (ctx.eventPosition !== null) {
    const center = ctx.eventPosition;
    for (const entity of state.entities.values()) {
      if (!isActor(entity) || !entity.isAlive) {
        continue;
      }
      if (entity.id === ctx.sourceEntityId || entity.id === ctx.targetEntityId) {
        continue;
      }

      const distance = chebyshevDistance(center, { x: entity.x, y: entity.y });
      if (distance <= RADIUS_LAYER_RADIUS) {
        for (const rule of entity.activeRules) {
          if (rule.effect.type === 'modifyDamage') {
            result.push({ layer: 'radius', rule, selfId: entity.id });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Оставляет только модификаторы, чей триггер совпадает с типом интента
 * и чьи обязательные теги содержатся в тегах интента.
 */
function filterModifiersByTrigger(
  rules: LayeredRule[],
  intent: Extract<Intent, { type: 'DAMAGE' }>,
): LayeredRule[] {
  return rules.filter(({ rule }) => {
    if (rule.trigger.event !== intent.type) {
      return false;
    }
    if (rule.trigger.tags && !hasAllTags(intent.tags, rule.trigger.tags)) {
      return false;
    }
    return true;
  });
}

/** Эффект `modifyDamage` с гарантированным op. */
type ModifyDamageEffect = Extract<
  ActiveRule['effect'],
  { type: 'modifyDamage' }
>;

/**
 * Сортирует модификаторы:
 * 1. по слою (source → target → world → radius);
 * 2. внутри слоя: сначала `multiply`, затем `add`;
 * 3. по приоритету (меньше — раньше);
 * 4. по ruleId для детерминированного tie-break.
 */
function sortModifiers(rules: LayeredRule[]): LayeredRule[] {
  return [...rules].sort((a, b) => {
    const layerDiff = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
    if (layerDiff !== 0) {
      return layerDiff;
    }

    const aEffect = a.rule.effect as ModifyDamageEffect;
    const bEffect = b.rule.effect as ModifyDamageEffect;
    const opDiff = OP_ORDER[aEffect.op] - OP_ORDER[bEffect.op];
    if (opDiff !== 0) {
      return opDiff;
    }

    const priorityDiff = a.rule.priority - b.rule.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.rule.id.localeCompare(b.rule.id);
  });
}

/**
 * Разрешает параметризованное числовое значение в конкретное число.
 */
function resolveParametrizedValue(
  value: number | ParametrizedValue,
  ctx: RuleContext,
): number {
  if (typeof value === 'number') {
    return value;
  }

  switch (value.type) {
    case 'literal':
      return value.value;
    case 'context':
      return ctx[value.field] ?? 0;
    default:
      return 0;
  }
}
