/**
 * Валидация ссылок на контентные правила.
 *
 * Проверяет, что все ruleIds, указанные в шаблонах предметов, способностей
 * и статусов, существуют в реестре правил, и что внутри одного шаблона
 * нет дублирующихся ruleIds.
 */

import type { LoadedContent } from '@content/schemas';
import { getRegistry } from './registry';

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
