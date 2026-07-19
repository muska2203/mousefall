/**
 * Точка входа для загрузки и валидации контента при старте приложения.
 *
 * Загружает все JSON-шаблоны контента, заполняет реестр и проверяет,
 * что все ссылки на контентные правила корректны.
 */

import {browserFetchJson, loadAllContent} from '@content/loader';
import {validateContentRuleReferences, validateContentRuleSemantics,} from '@simulation/content-rules/validation';
import {getRegistry} from '@content/registry';

/**
 * Загружает контент и валидирует ссылки на декларативные правила.
 */
export async function bootstrapContent(): Promise<void> {
  await loadAllContent(browserFetchJson);
  validateContentRuleReferences(getRegistry());

  const semanticsErrors = validateContentRuleSemantics(getRegistry());
  if (semanticsErrors.length > 0) {
    const messages = semanticsErrors
      .map((e) => `[${e.path}] ${e.field}: ${e.problem}`)
      .join('\n');
    throw new Error(`Семантические ошибки контентных правил:\n${messages}`);
  }
}
