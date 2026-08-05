/**
 * Тесты схемы и реестра реликвий (roadmap 0.2).
 *
 * Проверяет:
 * - RelicTemplateSchema: дефолты и валидацию полей;
 * - хелперы реестра getRelic/tryGetRelic/getAllRelics и локализованные варианты.
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {RelicTemplateSchema, type RelicTemplate} from '../../../src/content/schemas';
import {
  getAllLocalizedRelics,
  getAllRelics,
  getLocalizedRelic,
  getRelic,
  initRegistry,
  resetRegistry,
  tryGetLocalizedRelic,
  tryGetRelic,
} from '../../../src/content/registry';
import {createObjectContent} from '../../fixtures/gameState';
import {buildContent} from '../../../src/content/templates';

/** Минимальный шаблон реликвии с разумными дефолтами. */
function mockRelicTemplate(
  overrides: Partial<RelicTemplate> & { id: string },
): RelicTemplate {
  return {
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
    ...overrides,
  };
}

function createTestRelics(): Map<string, RelicTemplate> {
  return new Map([
    ['relic_test_charm', mockRelicTemplate({ id: 'relic_test_charm' })],
    ['relic_test_stack', mockRelicTemplate({ id: 'relic_test_stack', stackable: true })],
  ]);
}

describe('RelicTemplateSchema', () => {
  it('применяет дефолты для ruleIds, statModifiers, stackable, grantedAbilities и rarity', () => {
    const parsed = RelicTemplateSchema.parse({ id: 'relic_x' });
    expect(parsed.ruleIds).toEqual([]);
    expect(parsed.statModifiers).toEqual([]);
    expect(parsed.stackable).toBe(false);
    expect(parsed.grantedAbilities).toEqual([]);
    expect(parsed.rarity).toBe('common');
  });

  it('принимает полный шаблон', () => {
    const parsed = RelicTemplateSchema.parse({
      id: 'relic_x',
      ruleIds: [],
      statModifiers: [{ stat: 'damage', value: 2, op: 'add' }],
      stackable: true,
      rarity: 'unique',
      icon: 'assets/icons/relic.png',
      fallback: '🧿',
    });
    expect(parsed.stackable).toBe(true);
    expect(parsed.statModifiers).toHaveLength(1);
  });

  it('отклоняет дубликаты ruleIds', () => {
    const result = RelicTemplateSchema.safeParse({ id: 'relic_x', ruleIds: ['r1', 'r1'] });
    expect(result.success).toBe(false);
  });
});

describe('Реестр контента — реликвии', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createObjectContent({ relics: createTestRelics() }));
  });

  afterEach(() => {
    resetRegistry();
  });

  it('getRelic возвращает шаблон по ID', () => {
    const relic = getRelic('relic_test_charm');
    expect(relic.id).toBe('relic_test_charm');
    expect(relic.stackable).toBe(false);
  });

  it('getRelic бросает исключение для отсутствующего ID', () => {
    expect(() => getRelic('relic_missing')).toThrow('Relic template not found: "relic_missing"');
  });

  it('tryGetRelic возвращает undefined для отсутствующего ID', () => {
    expect(tryGetRelic('relic_missing')).toBeUndefined();
  });

  it('getAllRelics возвращает все шаблоны', () => {
    const ids = getAllRelics().map(r => r.id).sort();
    expect(ids).toEqual(['relic_test_charm', 'relic_test_stack']);
  });

  it('getLocalizedRelic возвращает шаблон с именем (fallback при отсутствии текстов)', () => {
    const localized = getLocalizedRelic('relic_test_stack', 'ru');
    expect(localized.id).toBe('relic_test_stack');
    expect(localized.name).toBe('[relic_test_stack]');
    expect(localized.flavorText).toBeUndefined();
  });

  it('tryGetLocalizedRelic возвращает локализованный шаблон или undefined', () => {
    expect(tryGetLocalizedRelic('relic_test_charm', 'en')).toBeDefined();
    expect(tryGetLocalizedRelic('relic_missing', 'ru')).toBeUndefined();
  });

  it('getAllLocalizedRelics возвращает все шаблоны с локализацией', () => {
    const localized = getAllLocalizedRelics('ru');
    expect(localized).toHaveLength(2);
  });

  it('реликвии опциональны: мок LoadedContent без поля relics не ломает хелперы', () => {
    resetRegistry();
    initRegistry(createObjectContent({ relics: undefined }));
    expect(tryGetRelic('relic_test_charm')).toBeUndefined();
    expect(getAllRelics()).toEqual([]);
  });
});

describe('Локализация реликвий — flavorText (реальный контент)', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(buildContent());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('getLocalizedRelic мержит flavorText из текстов (ru/en)', () => {
    expect(getLocalizedRelic('relic_salamander_heart', 'ru').flavorText).toContain('уголёк');
    expect(getLocalizedRelic('relic_salamander_heart', 'en').flavorText).toContain('ember');
  });

  it('tryGetLocalizedRelic и getAllLocalizedRelics тоже мержат flavorText', () => {
    expect(tryGetLocalizedRelic('relic_blood_pact', 'ru')?.flavorText).toBeDefined();
    const all = getAllLocalizedRelics('ru');
    expect(all).toHaveLength(8);
    expect(all.every(r => typeof r.flavorText === 'string' && r.flavorText.length > 0)).toBe(true);
  });
});
