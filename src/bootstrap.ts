/**
 * Точка входа для инициализации и валидации контента при старте приложения.
 *
 * Собирает контент из TypeScript-шаблонов (src/content/templates/),
 * заполняет реестр, проверяет ссылки на контентные правила
 * и предзагружает игровые ассеты.
 */

import {buildContent} from '@content/templates';
import {initRegistry, getRegistry} from '@content/registry';
import {validateContentReferences} from '@content/validate-references';
import {validateContentRuleReferences, validateContentRuleSemantics,} from '@simulation/content-rules/validation';
import {loadAssetManifest, preloadTextures} from '@ui/renderer/assetPreloader';

/**
 * Собирает контент и валидирует ссылки на декларативные правила.
 */
export async function bootstrapContent(): Promise<void> {
  initRegistry(buildContent());
  validateContentRuleReferences(getRegistry());

  const semanticsErrors = validateContentRuleSemantics(getRegistry());
  if (semanticsErrors.length > 0) {
    const messages = semanticsErrors
      .map((e) => `[${e.path}] ${e.field}: ${e.problem}`)
      .join('\n');
    throw new Error(`Семантические ошибки контентных правил:\n${messages}`);
  }

  const referenceErrors = validateContentReferences(getRegistry());
  if (referenceErrors.length > 0) {
    const messages = referenceErrors
      .map((e) => `[${e.path}] ${e.field}: ${e.problem}`)
      .join('\n');
    throw new Error(`Ошибки ссылок между шаблонами контента:\n${messages}`);
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
