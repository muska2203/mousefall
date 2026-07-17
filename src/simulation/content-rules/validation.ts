/**
 * Валидация ссылок на контентные правила и семантика декларативных правил.
 *
 * Проверяет, что все ruleIds, указанные в шаблонах предметов, способностей
 * и статусов, существуют в реестре правил, что внутри одного шаблона
 * нет дублирующихся ruleIds, а также что сами правила ссылаются на
 * реально существующий контент (статусы, формулы урона, способности)
 * и содержат корректные теги.
 */

import type { LoadedContent } from '@content/schemas';
import { getRegistry, getAllContentRules } from './registry';
import type { ContentRule, RuleCondition, RuleEffect } from './types';
import { hasWeaponFormula } from '@simulation/systems/stats/weapon-formulas';

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

  for (const [id, template] of content.items) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.abilities) {
    validateTemplateRuleIds(template.ruleIds, id);
  }

  for (const [id, template] of content.statuses) {
    validateTemplateRuleIds(template.ruleIds, id);
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
  const knownAbilityIds = new Set(content.abilities.keys());

  for (const rule of getAllContentRules()) {
    validateRuleTrigger(rule, errors);
    validateRuleEffect(rule, knownStatusIds, knownAbilityIds, errors);
    validateRuleConditions(rule, rule.conditions, errors);
    validateRuleConditions(rule, rule.targetConditions, errors);
  }

  return errors;
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
  knownAbilityIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  const effect = rule.effect;

  switch (effect.type) {
    case 'applyStatus':
      validateApplyStatusEffect(rule, effect, knownStatusIds, errors);
      break;
    case 'dealDamage':
      validateDealDamageEffect(rule, effect, errors);
      break;
    case 'heal':
      validateHealEffect(rule, effect, errors);
      break;
    case 'counterAttack':
      validateCounterAttackEffect(rule, effect, knownAbilityIds, errors);
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
 * Проверяет ссылку на формулу урона в эффекте dealDamage.
 */
function validateDealDamageEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'dealDamage' }>,
  errors: ContentRuleValidationError[],
): void {
  const damageFormulaId = (effect as { damageFormulaId?: string }).damageFormulaId;
  if (damageFormulaId === undefined) {
    return;
  }

  if (!hasWeaponFormula(damageFormulaId)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.damageFormulaId',
      problem: `Формула урона "${damageFormulaId}" не зарегистрирована`,
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
 * Проверяет ссылку на способность в эффекте counterAttack, если skillId указан.
 */
function validateCounterAttackEffect(
  rule: ContentRule,
  effect: Extract<RuleEffect, { type: 'counterAttack' }>,
  knownAbilityIds: ReadonlySet<string>,
  errors: ContentRuleValidationError[],
): void {
  const skillId = (effect as { skillId?: string }).skillId;
  if (skillId === undefined) {
    return;
  }

  if (!knownAbilityIds.has(skillId)) {
    errors.push({
      path: `rule.${rule.id}.effect`,
      ruleId: rule.id,
      field: 'effect.skillId',
      problem: `Способность "${skillId}" не найдена в реестре способностей`,
    });
  }
}

/**
 * Рекурсивно проверяет условия правила.
 */
function validateRuleConditions(
  rule: ContentRule,
  conditions: readonly RuleCondition[] | undefined,
  errors: ContentRuleValidationError[],
): void {
  if (!conditions) {
    return;
  }

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition) {
      validateCondition(rule, condition, i, errors);
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
    case 'and':
    case 'or':
      validateRuleConditions(rule, condition.conditions, errors);
      break;
    case 'not':
      validateCondition(rule, condition.condition, index, errors);
      break;
  }
}
