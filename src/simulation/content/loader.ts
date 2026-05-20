/**
 * Загрузчик контента.
 *
 * Загружает JSON-файлы контента из public/content/, валидирует их через Zod
 * и строит реестр LoadedContent.
 *
 * Вызывается один раз при старте приложения до начала игрового цикла.
 *
 * Правила:
 * - Загрузчик работает только в браузере (использует fetch)
 * - Системы симуляции никогда не вызывают загрузчик
 * - Тесты используют мок-контент напрямую через initRegistry()
 */

import type { LoadedContent } from '../schemas/contentSchemas';
import {
  EntityTemplateSchema,
  ItemTemplateSchema,
  AbilityTemplateSchema,
  MapParamsSchema,
} from '../schemas/contentSchemas';
import { initRegistry } from './registry';

// ─────────────────────────────────────────────
// Манифест контента
// ─────────────────────────────────────────────

/**
 * Перечисляет все файлы контента для загрузки.
 * Добавляйте новые файлы контента здесь — они будут загружены и валидированы автоматически.
 */
const CONTENT_MANIFEST = {
  entities: [
    '/content/entities/enemies/goblin.json',
    '/content/entities/enemies/orc.json',
    '/content/entities/enemies/cat_small.json',
    '/content/entities/enemies/cat_mid.json',
    '/content/entities/enemies/cat_big.json',
    '/content/entities/player/player.json',
  ],
  items: [
    '/content/items/consumables/health_potion.json',
    '/content/items/weapons/short_sword.json',
    '/content/items/armor/leather_armor.json',
  ],
  abilities: [
    '/content/abilities/fireball.json',
  ],
  maps: [
    '/content/maps/floor_1.json',
    '/content/maps/floor_2.json',
  ],
} as const;

// ─────────────────────────────────────────────
// Загрузчик
// ─────────────────────────────────────────────

/**
 * Загружает весь контент, валидирует и инициализирует реестр.
 * Выбрасывает исключение, если какой-либо файл не удалось загрузить или валидировать.
 */
export async function loadAllContent(): Promise<void> {
  const [entities, items, abilities, maps] = await Promise.all([
    loadCategory(CONTENT_MANIFEST.entities, EntityTemplateSchema),
    loadCategory(CONTENT_MANIFEST.items, ItemTemplateSchema),
    loadCategory(CONTENT_MANIFEST.abilities, AbilityTemplateSchema),
    loadCategory(CONTENT_MANIFEST.maps, MapParamsSchema),
  ]);

  const content: LoadedContent = {
    entities:  new Map(entities.map(e => [e.id, e])),
    items:     new Map(items.map(i => [i.id, i])),
    abilities: new Map(abilities.map(a => [a.id, a])),
    maps:      new Map(maps.map(m => [m.id, m])),
  };

  initRegistry(content);
}

// ─────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────

import { z } from 'zod';

// Используем ZodSchema (не ZodType), чтобы TypeScript корректно разрешил выходной тип
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCategory<S extends z.ZodSchema<any>>(
  paths: readonly string[],
  schema: S,
): Promise<z.output<S>[]> {
  return Promise.all(paths.map(path => loadAndValidate(path, schema)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAndValidate<S extends z.ZodSchema<any>>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  let json: unknown;

  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    json = await response.json();
  } catch (err) {
    throw new Error(`Failed to load content file "${path}": ${String(err)}`);
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const errors = result.error.errors
      .map((e: z.ZodIssue) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Content validation failed for "${path}":\n${errors}`);
  }

  return result.data as z.output<S>;
}
