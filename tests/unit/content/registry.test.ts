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
import {
  getAllProps,
  getLocalizedProp,
  getProp,
  tryGetLocalizedProp,
  tryGetProp,
} from '../../../src/content/registry';
import type { LoadedContent, PropTemplate, TileEffectStatusTemplate } from '../../../src/content/schemas';

function mockTileEffectStatusTemplate(
  overrides: Partial<TileEffectStatusTemplate> & { id: string },
): TileEffectStatusTemplate {
  return {
    duration: 3,
    neverExpires: false,
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

function mockPropTemplate(overrides: Partial<PropTemplate> & { id: string }): PropTemplate {
  return {
    maxHp: 10,
    armor: 0,
    blocksMovement: true,
    blocksLOS: false,
    renderScale: 1,
    propKind: 'barrel',
    tags: [],
    canHaveStatus: [],
    ...overrides,
  };
}

function createContentWithProps(): LoadedContent {
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
    tileEffectStatuses: new Map(),
    props: new Map([
      ['oil_barel', mockPropTemplate({ id: 'oil_barel', propKind: 'barrel', tags: ['prop.barrel', 'contains.oil'] })],
    ]),
  };
}

describe('Реестр контента — статусы тайловых эффектов', () => {
  beforeEach(() => {
    resetRegistry();
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

describe('Реестр контента — пропы', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContentWithProps());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('getProp возвращает шаблон по ID', () => {
    const prop = getProp('oil_barel');
    expect(prop.id).toBe('oil_barel');
    expect(prop.propKind).toBe('barrel');
    expect(prop.maxHp).toBe(10);
  });

  it('tryGetProp возвращает undefined для отсутствующего ID', () => {
    expect(tryGetProp('missing')).toBeUndefined();
  });

  it('getAllProps возвращает все шаблоны', () => {
    const props = getAllProps();
    expect(props).toHaveLength(1);
    expect(props[0]!.id).toBe('oil_barel');
  });

  it('getLocalizedProp возвращает локализованный шаблон', () => {
    const localized = getLocalizedProp('oil_barel', 'ru');
    expect(localized.name).toBe('Бочка с маслом');
    expect(localized.propKind).toBe('barrel');
  });

  it('tryGetLocalizedProp возвращает локализованный шаблон или undefined', () => {
    const found = tryGetLocalizedProp('oil_barel', 'en');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Oil Barrel');

    expect(tryGetLocalizedProp('missing', 'ru')).toBeUndefined();
  });
});
