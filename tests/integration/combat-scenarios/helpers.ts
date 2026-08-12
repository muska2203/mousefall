/**
 * Хелперы для интеграционных боевых сценариев.
 *
 * Собирает реальный контент из TypeScript-шаблонов (src/content/templates/),
 * чтобы сценарии работали с актуальными предметами, статусами
 * и контентными правилами.
 */

import { buildContent } from '../../../src/content/templates';
import { initRegistry, resetRegistry } from '../../../src/content/registry';

/**
 * Собирает весь контент из `src/content/templates/` в реестр.
 */
export function loadTestContent(): void {
  resetRegistry();
  initRegistry(buildContent());
}

/**
 * Подготовка к сценарию: реестр скиллов и контента.
 */
export function setupCombatScenario(): void {
}
