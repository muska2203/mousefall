/**
 * Хелперы для интеграционных боевых сценариев.
 *
 * Собирает реальный контент из TypeScript-шаблонов (src/content/templates/),
 * чтобы сценарии работали с актуальными предметами, статусами
 * и контентными правилами.
 */

import { buildContent } from '../../../src/content/templates';
import { getRegistry, initRegistry, resetRegistry } from '../../../src/content/registry';
import {
  ItemTemplateSchema,
  ModifierTemplateSchema,
  RelicTemplateSchema,
} from '../../../src/content/schemas';
import type {
  ItemTemplateInput,
  ModifierTemplateInput,
  RelicTemplateInput,
} from '../../../src/content/schemas';

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

/**
 * Регистрирует архивные шаблоны из `src/content/templates/legacy/` поверх
 * `loadTestContent()` — для сценариев, проверяющих движковые правила через
 * архивный контент. Предметы/модификаторы/реликвии первой итерации
 * архивированы и ждут переработки под билды
 * (см. `docs/plans/legacy-content-archival.md`).
 */
export function registerLegacyTemplates(templates: {
  items?: ItemTemplateInput[];
  modifiers?: ModifierTemplateInput[];
  relics?: RelicTemplateInput[];
}): void {
  const registry = getRegistry();
  for (const template of templates.items ?? []) {
    registry.items.set(template.id, ItemTemplateSchema.parse(template));
  }
  for (const template of templates.modifiers ?? []) {
    if (!registry.modifiers) registry.modifiers = new Map();
    registry.modifiers.set(template.id, ModifierTemplateSchema.parse(template));
  }
  for (const template of templates.relics ?? []) {
    if (!registry.relics) registry.relics = new Map();
    registry.relics.set(template.id, RelicTemplateSchema.parse(template));
  }
}
