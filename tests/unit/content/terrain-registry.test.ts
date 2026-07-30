/**
 * Тесты схемы и реестра террейнов (фаза 1 слоистой модели клетки).
 *
 * Проверяет:
 * - TerrainTemplateSchema: дефолты и валидацию полей;
 * - хелперы реестра getTerrain/tryGetTerrain/getAllTerrains и локализованные варианты.
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TerrainTemplateSchema} from '../../../src/content/schemas';
import {
  getAllLocalizedTerrains,
  getAllTerrains,
  getLocalizedTerrain,
  getTerrain,
  initRegistry,
  resetRegistry,
  tryGetLocalizedTerrain,
  tryGetTerrain,
} from '../../../src/content/registry';
import {createTestTerrains, createObjectContent} from '../../fixtures/gameState';

describe('TerrainTemplateSchema', () => {
  it('применяет дефолты для moveCost, blocksLOS, tags и ruleIds', () => {
    const parsed = TerrainTemplateSchema.parse({ id: 'floor', walkable: true });
    expect(parsed.moveCost).toBe(1);
    expect(parsed.blocksLOS).toBe(false);
    expect(parsed.tags).toEqual([]);
    expect(parsed.ruleIds).toEqual([]);
  });

  it('отклоняет moveCost < 1', () => {
    const result = TerrainTemplateSchema.safeParse({ id: 'bad', walkable: true, moveCost: 0 });
    expect(result.success).toBe(false);
  });

  it('требует явного walkable', () => {
    const result = TerrainTemplateSchema.safeParse({ id: 'bad' });
    expect(result.success).toBe(false);
  });

  it('принимает полный шаблон песка', () => {
    const parsed = TerrainTemplateSchema.parse({
      id: 'sand',
      walkable: true,
      moveCost: 2,
      blocksLOS: false,
      tags: ['ground'],
      ruleIds: [],
    });
    expect(parsed.moveCost).toBe(2);
    expect(parsed.tags).toContain('ground');
  });
});

describe('Реестр контента — террейны', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createObjectContent({ terrains: createTestTerrains() }));
  });

  afterEach(() => {
    resetRegistry();
  });

  it('getTerrain возвращает шаблон по ID', () => {
    const sand = getTerrain('sand');
    expect(sand.id).toBe('sand');
    expect(sand.moveCost).toBe(2);
    expect(sand.walkable).toBe(true);
  });

  it('getTerrain бросает исключение для отсутствующего ID', () => {
    expect(() => getTerrain('lava')).toThrow('Terrain template not found: "lava"');
  });

  it('tryGetTerrain возвращает undefined для отсутствующего ID', () => {
    expect(tryGetTerrain('lava')).toBeUndefined();
  });

  it('getAllTerrains возвращает все шаблоны', () => {
    const ids = getAllTerrains().map(t => t.id).sort();
    expect(ids).toEqual(['floor', 'sand', 'wall']);
  });

  it('getLocalizedTerrain возвращает локализованное название', () => {
    const localized = getLocalizedTerrain('sand', 'ru');
    expect(localized.name).toBe('Песок');
    expect(localized.moveCost).toBe(2);
  });

  it('tryGetLocalizedTerrain возвращает локализованный шаблон или undefined', () => {
    const found = tryGetLocalizedTerrain('sand', 'en');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Sand');
    expect(tryGetLocalizedTerrain('lava', 'ru')).toBeUndefined();
  });

  it('getAllLocalizedTerrains возвращает все шаблоны с локализацией', () => {
    const localized = getAllLocalizedTerrains('ru');
    expect(localized).toHaveLength(3);
    expect(localized.find(t => t.id === 'wall')!.name).toBe('Каменная стена');
  });

  it('террейны опциональны: мок LoadedContent без поля terrains не ломает хелперы', () => {
    resetRegistry();
    initRegistry(createObjectContent({ terrains: undefined }));
    expect(tryGetTerrain('floor')).toBeUndefined();
    expect(getAllTerrains()).toEqual([]);
  });
});
