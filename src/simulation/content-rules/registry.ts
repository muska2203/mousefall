/**
 * Реестр декларативных контентных правил.
 *
 * Правила регистрируются статически при импорте модуля. Предоставляет быстрый
 * доступ по id и базовую защиту от дубликатов.
 */

import {CONTENT_RULES, WORLD_CONTENT_RULES} from './rules';
import type {ContentRule} from './types';

const RULES_BY_ID: ReadonlyMap<string, ContentRule> = buildRulesMap();

/**
 * Переопределение контентных правил, используемое только в тестах.
 * Позволяет подключать тестовые source-bound правила (предметы, статусы,
 * способности) без загрязнения production-реестра.
 */
let contentRulesOverride: ReadonlyMap<string, ContentRule> | null = null;

/**
 * Строит карту правил по id, проверяя уникальность идентификаторов.
 */
function buildRulesMap(): Map<string, ContentRule> {
  const map = new Map<string, ContentRule>();

  for (const rule of CONTENT_RULES) {
    if (map.has(rule.id)) {
      throw new Error(`Дублирующийся id контентного правила: "${rule.id}"`);
    }
    map.set(rule.id, rule);
  }

  for (const rule of WORLD_CONTENT_RULES) {
    if (map.has(rule.id)) {
      throw new Error(`Дублирующийся id контентного правила: "${rule.id}"`);
    }
    map.set(rule.id, rule);
  }

  return map;
}

/**
 * Возвращает карту правил с учётом переопределения для тестов.
 */
function getMergedRules(): ReadonlyMap<string, ContentRule> {
  if (contentRulesOverride === null) {
    return RULES_BY_ID;
  }

  const merged = new Map<string, ContentRule>(RULES_BY_ID);
  for (const [id, rule] of contentRulesOverride) {
    merged.set(id, rule);
  }
  return merged;
}

/**
 * Возвращает правило по id. Выбрасывает исключение, если правило не найдено.
 */
export function getContentRule(id: string): ContentRule {
  const rule = tryGetContentRule(id);
  if (!rule) {
    throw new Error(`Контентное правило не найдено: "${id}"`);
  }
  return rule;
}

/**
 * Возвращает правило по id или undefined, если правило не найдено.
 */
export function tryGetContentRule(id: string): ContentRule | undefined {
  return contentRulesOverride?.get(id) ?? RULES_BY_ID.get(id);
}

/**
 * Возвращает все зарегистрированные контентные правила.
 */
export function getAllContentRules(): readonly ContentRule[] {
  return [...getMergedRules().values()];
}

/**
 * Возвращает внутреннюю карту правил для валидации и отладки.
 */
export function getRegistry(): ReadonlyMap<string, ContentRule> {
  return getMergedRules();
}

/**
 * Устанавливает переопределение контентных правил.
 *
 * Передача `null` сбрасывает переопределение. Используется исключительно
 * в тестах для подключения тестовых правил без загрязнения production-реестра.
 */
export function setContentRulesOverride(
  rules: readonly ContentRule[] | null,
): void {
  if (rules === null) {
    contentRulesOverride = null;
    return;
  }

  const map = new Map<string, ContentRule>();
  for (const rule of rules) {
    if (map.has(rule.id)) {
      throw new Error(`Дублирующийся id в переопределении контентных правил: "${rule.id}"`);
    }
    map.set(rule.id, rule);
  }
  contentRulesOverride = map;
}
