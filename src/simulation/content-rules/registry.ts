/**
 * Реестр декларативных контентных правил.
 *
 * Правила регистрируются статически при импорте модуля. Предоставляет быстрый
 * доступ по id и базовую защиту от дубликатов.
 */

import { CONTENT_RULES, WORLD_CONTENT_RULES } from './rules';
import type { ContentRule } from './types';

const RULES_BY_ID: ReadonlyMap<string, ContentRule> = buildRulesMap();

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
 * Возвращает правило по id. Выбрасывает исключение, если правило не найдено.
 */
export function getContentRule(id: string): ContentRule {
  const rule = RULES_BY_ID.get(id);
  if (!rule) {
    throw new Error(`Контентное правило не найдено: "${id}"`);
  }
  return rule;
}

/**
 * Возвращает правило по id или undefined, если правило не найдено.
 */
export function tryGetContentRule(id: string): ContentRule | undefined {
  return RULES_BY_ID.get(id);
}

/**
 * Возвращает все зарегистрированные контентные правила.
 */
export function getAllContentRules(): readonly ContentRule[] {
  return [...CONTENT_RULES, ...WORLD_CONTENT_RULES];
}

/**
 * Возвращает внутреннюю карту правил для валидации и отладки.
 */
export function getRegistry(): ReadonlyMap<string, ContentRule> {
  return RULES_BY_ID;
}
