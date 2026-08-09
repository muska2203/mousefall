/**
 * Валидация ссылок на контентные правила и семантика декларативных правил.
 *
 * Проверяет, что все ruleIds, указанные в шаблонах предметов, способностей,
 * статусов, тайловых эффектов, статусов тайловых эффектов, террейнов и точек интереса, существуют в реестре правил,
 * что внутри одного шаблона нет дублирующихся ruleIds, а также что сами правила
 * ссылаются на реально существующий контент (статусы, формулы урона, способности,
 * тайловые эффекты и их статусы) и содержат корректные теги.
 */

import type {LoadedContent} from '@content/schemas';
import {getAllContentRules, getRegistry, tryGetContentRule} from './registry';
import type {ContentRule, RuleCondition, RuleEffect} from './types';

/**
 * Описание найденной ошибки валидации.
 */
export type ContentRuleValidationError = {
  /** Путь к объекту: rule, item/ability/status ID и т.д. */
  path: string;
  /** Идентификатор правила, если ошибка связана с конкретным правилом. */
  ruleId?: string;
  /** Поле, в котором обнаружена проблема. */
  field: string;
  /** Понятное описание проблемы. */
  problem: string;
};

/**
 * Проверяет ruleIds всех шаблонов контента.
 * Выбрасывает исключение при неизвестном правиле или дублировании в шаблоне.
 */
export function validateContentRuleReferences(content: LoadedContent): void {
  const knownRuleIds = new Set(getRegistry().keys());

  /**
   * Проверяет список ruleIds одного шаблона.
   */
  function validateTemplateRuleIds(templateRuleIds: readonly string[], ownerId: string): void {
    const seen = new Set<string>();

    for (const ruleId of templateRuleIds) {
      if (!knownRuleIds.has(ruleId)) {
        throw new Error(
          `Шаблон "${ownerId}" ссылается на неизвестное контентное правило "${ruleId}"`,
        );
      }

      if (seen.has(ruleId)) {
        throw new Error(
          `Шаблон "${ownerId}" содержит дублирующийся ruleId "${ruleId}"`,
        );
      }

      seen.add(ruleId);
    }
  }

  for (const [id, template] of content.abilities) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.statuses) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.tileEffects) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.tileEffectStatuses) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.terrains ?? new Map()) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.pois ?? new Map()) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.traps ?? new Map()) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.relics ?? new Map()) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  // Rule-аффиксы ссылаются на контентные правила через effect.ruleId.
  for (const [id, modifier] of content.modifiers ?? new Map()) {
    if (modifier.effect.kind === 'rule') {
      validateTemplateRuleIds([modifier.effect.ruleId], id);
    }
  }
}

/**
 * Проверяет семантику декларативных контентных правил.
 *
 * Возвращает массив ошибок без выброса исключений, чтобы скрипты валидации
 * могли собрать полный отчёт по контенту.
 */
export function validateContentRuleSemantics(content: LoadedContent): ContentRuleValidationError[] {
  const errors: ContentRuleValidationError[] = [];
  const knownStatusIds = new Set(content.statuses.keys());
  const knownTileEffectStatusIds = new Set(content.tileEffectStatuses.keys());
  const knownTileEffectIds = new Set(content.tileEffects.keys());

  for (const rule of getAllContentRules()) {
    validateRuleTrigger(rule, errors);
    validateRuleEffect(rule, knownStatusIds, knownTileEffectStatusIds, knownTileEffectIds, errors);
    validateRuleConditions(rule, rule.conditions, knownTileEffectIds, knownTileEffectStatusIds, errors);
    validateRuleConditions(rule, rule.targetConditions, knownTileEffectIds, knownTileEffectStatusIds, errors);
  }

  validateTileEffectTemplates(content.tileEffects, knownTileEffectStatusIds, errors);
  validateModifierTemplates(content, errors);

  return errors;
}

/**
 * Рекурсивно ищет ParametrizedValue { type: 'ownerParam' } внутри эффекта правила.
 */
function effectContainsOwnerParam(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(effectContainsOwnerParam);
  const record = value as Record<string, unknown>;
  if (record['type'] === 'ownerParam') return true;
  return Object.values(record).some(effectContainsOwnerParam);
}

/**
 * Проверяет инварианты шаблонов модификаторов (аффиксов):
 * - stat-аффикс обязан иметь scaling perLevel или fixed — иначе значения нет
 *   и модификатор применится со значением 0;
 * - rule-аффикс со scaling perLevel допустим, только если эффект правила
 *   содержит ParametrizedValue { type: 'ownerParam' } — куда подставлять
 *   ролленное значение экземпляра.
 */
function validateModifierTemplates(
  content: LoadedContent,
  errors: ContentRuleValidationError[],
): void {
  for (const [id, modifier] of content.modifiers ?? new Map()) {
    if (modifier.effect.kind === 'stat') {
      if (modifier.scaling.kind === 'none') {
        errors.push({
          path: `modifiers.${id}`,
          field: 'scaling',
          problem: 'Stat-аффикс требует scaling perLevel или fixed: без значения модификатор применится со значением 0',
        });
      }
      continue;
    }

    if (modifier.scaling.kind !== 'perLevel') continue;

    const rule = tryGetContentRule(modifier.effect.ruleId);
    // Существование ruleId проверяется в validateContentRuleReferences.
    if (!rule) continue;

    if (!effectContainsOwnerParam(rule.effect)) {
      errors.push({
        path: `modifiers.${id}`,
        field: 'scaling',
        problem: `Rule-аффикс со scaling perLevel требует ParametrizedValue { type: 'ownerParam' } в эффекте правила "${modifier.effect.ruleId}"`,
      });
    }
  }
}

/**
 * Проверяет шаблоны тайловых эффектов на корректность ссылок.
 */
function validateTileEffectTemplates(
  tileEffects: LoadedContent['tileEffects'],
  knownTileEffectStatusIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  for (const [id, template] of tileEffects) {
    for (let i = 0; i < template.durationDecreasesWhenHasStatus.length; i++) {
      const statusType = template.durationDecreasesWhenHasStatus[i];
      if (statusType === undefined) continue;
      if (!knownTileEffectStatusIds.has(statusType)) {
        errors.push({
          path: `tileEffect.${id}.durationDecreasesWhenHasStatus[${i}]`,
          field: 'durationDecreasesWhenHasStatus',
          problem: `Статус тайлового эффекта "${statusType}" не найден в реестре`,
        });
      }
    }
  }
}

/**
 * Проверяет триггер правила.
 */
function validateRuleTrigger(rule: ContentRule, errors: ContentRuleValidationError[]): void {
  if (rule.trigger.tags === undefined || rule.trigger.tags === null) {
    return;
  }

  if (rule.trigger.tags.length === 0) {
    errors.push({
      path: `rule.${rule.id}.trigger`,
      ruleId: rule.id,
      field: 'trigger.tags',
      problem: 'Массив тегов триггера пуст; укажите хотя бы один тег или удалите поле',
    });
    return;
  }

  for (let i = 0; i < rule.trigger.tags.length; i++) {
    const tag = rule.trigger.tags[i];
    if (typeof tag !== 'string' || tag.length === 0) {
      errors.push({
        path: `rule.${rule.id}.trigger.tags[${i}]`,
        ruleId: rule.id,
        field: 'trigger.tags',
        problem: `Тег #${i} триггера пустой или не является строкой`,
      });
    }
  }
}

/**
 * Проверяет эффект правила на корректность ссылок контента.
 */
function validateRuleEffect(
  rule: ContentRule,
  knownStatusIds: ReadonlySet<string>,
  knownTileEffectStatusIds: ReadonlySet<string>,
  knownTileEffectIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  const effect = rule.effect;

  switch (effect.type) {
    case 'applyStatus':
      validateApplyStatusEffect(rule, effect, knownStatusIds, errors);
      break;
    case 'applyTileEffectStatus':
      validateApplyTileEffectStatusEffect(rule, effect, knownTileEffectStatusIds, knownTileEffectIds, errors);
      break;
    case 'heal':
      validateHealEffect(rule, effect, errors);
      break;
    case 'spawnTileEffect':
      validateSpawnTileEffectEffect(rule, effect, knownTileEffectIds, knownTileEffectStatusIds, errors);
      break;
  }
}

/**
 * Проверяет ссылку на статус в эффекте applyStatus.
 */
function validateApplyStatusEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'applyStatus' }>,
  knownStatusIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  if (!knownStatusIds.has(effect.statusType)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.statusType',
      problem: `Статус "${effect.statusType}" не найден в реестре статусов`,
    });
  }
}

/**
 * Проверяет ссылку на статус тайлового эффекта и целевой тайловый эффект
 * в эффекте applyTileEffectStatus.
 */
function validateApplyTileEffectStatusEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'applyTileEffectStatus' }>,
  knownTileEffectStatusIds: ReadonlySet<string>,
  knownTileEffectIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  if (!knownTileEffectStatusIds.has(effect.statusType)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.statusType',
      problem: `Статус тайлового эффекта "${effect.statusType}" не найден в реестре`,
    });
  }

  if (rule.target.type !== 'eventTileEffect' && rule.target.type !== 'tilesInRadius') {
    errors.push({
      path: `rule.${rule.id}.target`,
      ruleId: rule.id,
      field: 'target.type',
      problem: 'Эффект applyTileEffectStatus требует target.type === "eventTileEffect" или "tilesInRadius"',
    });
    return;
  }

  if (!knownTileEffectIds.has(rule.target.effectType)) {
    errors.push({
      path: `rule.${rule.id}.target`,
      ruleId: rule.id,
      field: 'target.effectType',
      problem: `Тайловый эффект "${rule.target.effectType}" не найден в реестре`,
    });
  }
}

/**
 * Проверяет ссылку на тайловый эффект и целевой селектор
 * в эффекте spawnTileEffect.
 */
function validateSpawnTileEffectEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'spawnTileEffect' }>,
  knownTileEffectIds: ReadonlySet<string>,
  knownTileEffectStatusIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  if (!knownTileEffectIds.has(effect.effectType)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.effectType',
      problem: `Тайловый эффект "${effect.effectType}" не найден в реестре`,
    });
  }

  if (rule.target.type !== 'positionsInRadius') {
    errors.push({
      path: `rule.${rule.id}.target`,
      ruleId: rule.id,
      field: 'target.type',
      problem: 'Эффект spawnTileEffect требует target.type === "positionsInRadius"',
    });
  }

  const statusType = (effect as { statusType?: string }).statusType;
  if (statusType !== undefined && !knownTileEffectStatusIds.has(statusType)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.statusType',
      problem: `Статус тайлового эффекта "${statusType}" не найден в реестре`,
    });
  }
}

/**
 * Проверяет ссылку на формулу лечения в эффекте heal.
 *
 * На текущий момент реестр формул лечения не вынесен в отдельный модуль,
 * поэтому поле healFormulaId только фиксируется: если оно указано,
 * проверка не может быть выполнена без дополнительной инфраструктуры.
 */
function validateHealEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'heal' }>,
  errors: ContentRuleValidationError[],
): void {
  const healFormulaId = (effect as { healFormulaId?: string }).healFormulaId;
  if (healFormulaId === undefined) {
    return;
  }

  // TODO(WP6.3+): добавить реестр формул лечения и проверять healFormulaId.
  // Сейчас поле игнорируется, чтобы не ломать существующий контент.
  void errors;
  void effect;
}

/**
 * Рекурсивно проверяет условия правила.
 */
function validateRuleConditions(
  rule: ContentRule,
  conditions: readonly RuleCondition[] | undefined,
  knownTileEffectIds: ReadonlySet<string>,
  knownTileEffectStatusIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  if (!conditions) {
    return;
  }

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition) {
      validateCondition(rule, condition, i, knownTileEffectIds, knownTileEffectStatusIds, errors);
    }
  }
}

/**
 * Проверяет одно условие и его вложенные условия.
 */
function validateCondition(
  rule: ContentRule,
  condition: RuleCondition,
  index: number,
  knownTileEffectIds: ReadonlySet<string>,
  knownTileEffectStatusIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  switch (condition.type) {
    case 'hasTag':
      if (typeof condition.tag !== 'string' || condition.tag.length === 0) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.tag',
          problem: 'Условие hasTag содержит пустой тег',
        });
      }
      break;
    case 'entityHasTag':
      if (typeof condition.tag !== 'string' || condition.tag.length === 0) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.tag',
          problem: 'Условие entityHasTag содержит пустой тег',
        });
      }
      if (condition.subject !== 'self' && condition.subject !== 'source' && condition.subject !== 'target' && condition.subject !== 'candidate') {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.subject',
          problem: 'Условие entityHasTag должно иметь subject из "self" / "source" / "target" / "candidate"',
        });
      }
      break;
    case 'eventFieldEquals':
      if (typeof condition.field !== 'string' || condition.field.length === 0) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.field',
          problem: 'Условие eventFieldEquals содержит пустое имя поля события',
        });
      }
      break;
    case 'eventRole':
      if (condition.role !== 'source' && condition.role !== 'target') {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.role',
          problem: 'Условие eventRole должно иметь значение "source" или "target"',
        });
      }
      break;
    case 'inTileEffect':
      if (!knownTileEffectIds.has(condition.effectType)) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.effectType',
          problem: `Тайловый эффект "${condition.effectType}" не найден в реестре`,
        });
      }
      break;
    case 'tileEffectHasStatus':
      if (!knownTileEffectIds.has(condition.effectType)) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.effectType',
          problem: `Тайловый эффект "${condition.effectType}" не найден в реестре`,
        });
      }
      if (!knownTileEffectStatusIds.has(condition.statusType)) {
        errors.push({
          path: `rule.${rule.id}.conditions[${index}]`,
          ruleId: rule.id,
          field: 'condition.statusType',
          problem: `Статус тайлового эффекта "${condition.statusType}" не найден в реестре`,
        });
      }
      break;
    case 'and':
    case 'or':
      validateRuleConditions(rule, condition.conditions, knownTileEffectIds, knownTileEffectStatusIds, errors);
      break;
    case 'not':
      validateCondition(rule, condition.condition, index, knownTileEffectIds, knownTileEffectStatusIds, errors);
      break;
  }
}
