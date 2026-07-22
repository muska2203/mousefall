import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initRegistry,
  resetRegistry,
  tryGetTileEffectStatus,
  getAllTileEffectStatuses,
  getLocalizedTileEffectStatus,
  tryGetLocalizedTileEffectStatus,
  getAllLocalizedTileEffectStatuses,
} from '../../../src/content/registry';
import type { LoadedContent, TileEffectStatusTemplate } from '../../../src/content/schemas';

function mockTileEffectStatusTemplate(
  overrides: Partial<TileEffectStatusTemplate> & { id: string },
): TileEffectStatusTemplate {
  return {
    duration: 3,
    ruleIds: [],
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    renderOrder: 1,
    ...overrides,
  };
}

function createContentWithStatuses(): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    statuses: new Map(),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map([
      ['burning', mockTileEffectStatusTemplate({ id: 'burning', statusCategory: 'elemental', renderOrder: 10 })],
    ]),
  };
}

describe('Реестр контента — статусы тайловых эффектов', () => {
  beforeEach(() => {
    initRegistry(createContentWithStatuses());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('tryGetTileEffectStatus возвращает шаблон по ID', () => {
    const status = tryGetTileEffectStatus('burning');
    expect(status).toBeDefined();
    expect(status!.id).toBe('burning');
    expect(status!.statusCategory).toBe('elemental');
    expect(status!.renderOrder).toBe(10);
  });

  it('tryGetTileEffectStatus возвращает undefined для отсутствующего ID', () => {
    expect(tryGetTileEffectStatus('missing')).toBeUndefined();
  });

  it('getAllTileEffectStatuses возвращает все шаблоны', () => {
    const statuses = getAllTileEffectStatuses();
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.id).toBe('burning');
  });

  it('getLocalizedTileEffectStatus возвращает локализованное название', () => {
    const localized = getLocalizedTileEffectStatus('burning', 'ru');
    expect(localized.name).toBe('Горящая поверхность');
    expect(localized.id).toBe('burning');
  });

  it('tryGetLocalizedTileEffectStatus возвращает локализованный шаблон или undefined', () => {
    const found = tryGetLocalizedTileEffectStatus('burning', 'en');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Burning surface');

    expect(tryGetLocalizedTileEffectStatus('missing', 'ru')).toBeUndefined();
  });

  it('getAllLocalizedTileEffectStatuses возвращает все шаблоны с локализацией', () => {
    const localized = getAllLocalizedTileEffectStatuses('ru');
    expect(localized).toHaveLength(1);
    expect(localized[0]!.name).toBe('Горящая поверхность');
  });
});
