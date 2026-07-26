/**
 * Точка входа для загрузки и валидации контента при старте приложения.
 *
 * Загружает все JSON-шаблоны контента, заполняет реестр, проверяет
 * ссылки на контентные правила и предзагружает игровые ассеты.
 */

import {browserFetchJson, loadAllContent} from '@content/loader';
import {validateContentRuleReferences, validateContentRuleSemantics,} from '@simulation/content-rules/validation';
import {getRegistry} from '@content/registry';
import {loadAssetManifest, preloadTextures} from '@ui/renderer/assetPreloader';

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

/**
 * Загружает манифест ассетов и прогревает кеш текстур.
 */
export async function bootstrapAssets(): Promise<void> {
  const urls = await loadAssetManifest();
  await preloadTextures(urls);
}

/**
 * Полная загрузка приложения: контент + ассеты.
 */
export async function bootstrap(): Promise<void> {
  await bootstrapContent();
  await bootstrapAssets();
}
