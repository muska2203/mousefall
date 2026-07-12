/**
 * Точка входа для загрузки и валидации контента при старте приложения.
 *
 * Загружает все JSON-шаблоны контента, заполняет реестр и проверяет,
 * что все ссылки на контентные правила корректны.
 */

import { loadAllContent, browserFetchJson } from '@content/loader';
import { validateContentRuleReferences } from '@simulation/content-rules/validation';
import { getRegistry } from '@content/registry';

/**
 * Загружает контент и валидирует ссылки на декларативные правила.
 */
export async function bootstrapContent(): Promise<void> {
  await loadAllContent(browserFetchJson);
  validateContentRuleReferences(getRegistry());
}
