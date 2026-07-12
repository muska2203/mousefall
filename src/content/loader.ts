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

import type { LoadedContent } from './schemas';
import {
  EntityTemplateSchema,
  PlayerTemplateSchema,
  ItemTemplateSchema,
  AbilityTemplateSchema,
  StatusTemplateSchema,
  MapParamsSchema,
  StairsTemplateSchema,
  DoorTemplateSchema,
} from './schemas';
import { initRegistry } from './registry';
import { z } from 'zod';

// ─────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────

/** Функция загрузки JSON по пути. Независима от среды (браузер / Node / тесты). */
export type FetchJson = (path: string) => Promise<unknown>;

// ─────────────────────────────────────────────
// Схема манифеста
// ─────────────────────────────────────────────

const ManifestSchema = z.object({
  entities: z.array(z.string()),
  players: z.array(z.string()),
  items: z.array(z.string()),
  abilities: z.array(z.string()),
  statuses: z.array(z.string()),
  maps: z.array(z.string()),
  stairs: z.array(z.string()),
  doors: z.array(z.string()),
});

type Manifest = z.infer<typeof ManifestSchema>;

// ─────────────────────────────────────────────
// Браузерная реализация fetchJson
// ─────────────────────────────────────────────

export async function browserFetchJson(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ─────────────────────────────────────────────
// Загрузчик
// ─────────────────────────────────────────────

/**
 * Загружает манифест контента, затем загружает и валидирует все перечисленные файлы.
 * Выбрасывает исключение, если манифест или какой-либо файл не удалось загрузить/валидировать.
 *
 * @param fetchJson — функция загрузки JSON. В браузере передайте {@link browserFetchJson},
 *                    в Node / тестах — обёртку над fs.readFile или мок.
 */
export async function loadAllContent(fetchJson: FetchJson): Promise<void> {
  const manifest = await loadManifest(fetchJson);

  const [entities, players, items, abilities, statuses, maps, stairs, doors] = await Promise.all([
    loadCategory(manifest.entities, EntityTemplateSchema, fetchJson),
    loadCategory(manifest.players, PlayerTemplateSchema, fetchJson),
    loadCategory(manifest.items, ItemTemplateSchema, fetchJson),
    loadCategory(manifest.abilities, AbilityTemplateSchema, fetchJson),
    loadCategory(manifest.statuses, StatusTemplateSchema, fetchJson),
    loadCategory(manifest.maps, MapParamsSchema, fetchJson),
    loadCategory(manifest.stairs, StairsTemplateSchema, fetchJson),
    loadCategory(manifest.doors, DoorTemplateSchema, fetchJson),
  ]);

  const content: LoadedContent = {
    entities:  new Map(entities.map(e => [e.id, e])),
    players:   new Map(players.map(p => [p.id, p])),
    items:     new Map(items.map(i => [i.id, i])),
    abilities: new Map(abilities.map(a => [a.id, a])),
    statuses:  new Map(statuses.map(s => [s.id, s])),
    maps:      new Map(maps.map(m => [m.id, m])),
    stairs:    new Map(stairs.map(s => [s.id, s])),
    doors:     new Map(doors.map(d => [d.id, d])),
  };

  initRegistry(content);
}

// ─────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────

async function loadManifest(fetchJson: FetchJson): Promise<Manifest> {
  let json: unknown;
  try {
    json = await fetchJson('/content/manifest.json');
  } catch (err) {
    throw new Error(`Failed to load content manifest: ${String(err)}`);
  }

  const result = ManifestSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.errors
      .map((e: z.ZodIssue) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Content manifest validation failed:\n${errors}`);
  }

  return result.data;
}

// Используем ZodSchema (не ZodType), чтобы TypeScript корректно разрешил выходной тип
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCategory<S extends z.ZodSchema<any>>(
  paths: readonly string[],
  schema: S,
  fetchJson: FetchJson,
): Promise<z.output<S>[]> {
  return Promise.all(paths.map(path => loadAndValidate(path, schema, fetchJson)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAndValidate<S extends z.ZodSchema<any>>(
  path: string,
  schema: S,
  fetchJson: FetchJson,
): Promise<z.output<S>> {
  let json: unknown;

  try {
    json = await fetchJson(path);
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
