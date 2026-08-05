/**
 * Сборка игрового контента из TypeScript-шаблонов.
 *
 * Шаблоны лежат в этом каталоге по папкам-категориям и пишутся через
 * `satisfies XTemplateInput` (см. src/content/schemas.ts). buildContent()
 * парсит их через Zod-схемы (заполняет дефолты, проверяет инварианты)
 * и собирает LoadedContent для реестра.
 *
 * Вызывается один раз при старте приложения (bootstrap) и в скрипте
 * валидации контента. Тесты используют мок-контент напрямую через initRegistry().
 */

import {z} from 'zod';

import type {LoadedContent} from '../schemas';
import {
  AbilityTemplateSchema,
  DoorTemplateSchema,
  EntityTemplateSchema,
  ItemTemplateSchema,
  MapParamsSchema,
  PlayerTemplateSchema,
  PoiTemplateSchema,
  PropTemplateSchema,
  RelicTemplateSchema,
  StairsTemplateSchema,
  StatusTemplateSchema,
  TerrainTemplateSchema,
  TileEffectStatusTemplateSchema,
  TileEffectTemplateSchema,
  TrapTemplateSchema,
} from '../schemas';

import {abilityTemplates} from './abilities';
import {doorTemplates} from './doors';
import {entityTemplates} from './entities';
import {itemTemplates} from './items';
import {mapParams} from './maps';
import {playerTemplates} from './players';
import {poiTemplates} from './pois';
import {propTemplates} from './props';
import {relicTemplates} from './relics';
import {stairsTemplates} from './stairs';
import {statusTemplates} from './statuses';
import {terrainTemplates} from './terrains';
import {tileEffectStatusTemplates} from './tile-effect-statuses';
import {tileEffectTemplates} from './tile-effects';
import {trapTemplates} from './traps';

/**
 * Парсит шаблоны категории через Zod-схему и собирает карту по id.
 * Выбрасывает исключение при ошибке валидации или дубле id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCategory<S extends z.ZodSchema<any>>(
  category: string,
  inputs: readonly z.input<S>[],
  schema: S,
): Map<string, z.output<S>> {
  const map = new Map<string, z.output<S>>();
  for (const input of inputs) {
    const id = (input as {id?: string}).id ?? '<без id>';
    let parsed: z.output<S>;
    try {
      parsed = schema.parse(input);
    } catch (err) {
      const details = err instanceof z.ZodError
        ? err.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n')
        : String(err);
      throw new Error(`Ошибка валидации шаблона "${id}" (категория "${category}"):\n${details}`);
    }
    if (map.has(parsed.id)) {
      throw new Error(`Дубль id "${parsed.id}" в категории "${category}"`);
    }
    map.set(parsed.id, parsed);
  }
  return map;
}

/**
 * Собирает и валидирует весь игровой контент.
 * Fail-fast: любая ошибка валидации или дубль id приводят к исключению.
 */
export function buildContent(): LoadedContent {
  return {
    entities: buildCategory('entities', entityTemplates, EntityTemplateSchema),
    players: buildCategory('players', playerTemplates, PlayerTemplateSchema),
    items: buildCategory('items', itemTemplates, ItemTemplateSchema),
    abilities: buildCategory('abilities', abilityTemplates, AbilityTemplateSchema),
    statuses: buildCategory('statuses', statusTemplates, StatusTemplateSchema),
    tileEffects: buildCategory('tileEffects', tileEffectTemplates, TileEffectTemplateSchema),
    tileEffectStatuses: buildCategory('tileEffectStatuses', tileEffectStatusTemplates, TileEffectStatusTemplateSchema),
    maps: buildCategory('maps', mapParams, MapParamsSchema),
    stairs: buildCategory('stairs', stairsTemplates, StairsTemplateSchema),
    doors: buildCategory('doors', doorTemplates, DoorTemplateSchema),
    props: buildCategory('props', propTemplates, PropTemplateSchema),
    terrains: buildCategory('terrains', terrainTemplates, TerrainTemplateSchema),
    pois: buildCategory('pois', poiTemplates, PoiTemplateSchema),
    traps: buildCategory('traps', trapTemplates, TrapTemplateSchema),
    relics: buildCategory('relics', relicTemplates, RelicTemplateSchema),
  };
}
