/**
 * Тесты сборки ViewModel коллекции реликвий (панель реликвий, roadmap 0.3).
 *
 * Проверяет группировку по шаблонам (стаки), порядок (порядок получения),
 * перенос локализации/иконок/рамки в VM, пустую коллекцию и неизвестные шаблоны.
 *
 * Тест отвязан от реального контента: шаблоны реликвий — синтетические
 * (свой initRegistry), тексты подменяются на уровне `texts/lookup`.
 * Все значения в assert'ах происходят из фикстур этого файла,
 * поэтому балансные правки шаблонов и текстов тест не ломают.
 *
 * Техническая деталь: глобальный setup (tests/setup/vitest-env.ts) уже
 * вычислил `content/registry` с настоящим `texts/lookup` до регистрации мока,
 * поэтому модули реестра/сессии переимпортируются динамически
 * после `vi.resetModules()` — иначе мок lookup не доходит до реестра.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '@i18n/config';
import type {GameSession} from '../../../src/presentation/gameSession';
import type {RelicTemplate} from '../../../src/content/schemas';
import type {ContentText} from '../../../src/content/texts/types';
import type {Entity, EntityId, RelicInstance} from '../../../src/simulation/types';

// ─────────────────────────────────────────────
// Тестовые тексты: подменяют texts/{ru,en} на уровне lookup
// ─────────────────────────────────────────────

type TestTextMap = Record<string, Record<string, {ru: ContentText; en?: ContentText}>>;

// Тип выводится из литерала: конкретные ключи фикстур доступны без undefined.
const testTexts = vi.hoisted(() => ({
  relics: {
    relic_test_ember: {
      ru: {name: 'Тестовый уголёк', flavorText: 'Пахнет тестовым дымом.'},
      en: {name: 'Test Ember', flavorText: 'Smells of test smoke.'},
    },
    relic_test_charm: {
      ru: {name: 'Тестовый оберег'},
      en: {name: 'Test Charm'},
    },
    relic_test_pact: {
      ru: {name: 'Тестовый договор'},
      en: {name: 'Test Pact'},
    },
  },
  rules: {
    test_rule_fire_infusion: {
      ru: {name: 'Инфузия', description: 'Тест: удары оружия становятся огненными.'},
      en: {name: 'Infusion', description: 'Test: weapon hits become fiery.'},
    },
    test_rule_fire_vulnerability: {
      ru: {name: 'Уязвимость', description: 'Тест: входящий огонь бьёт сильнее.'},
      en: {name: 'Vulnerability', description: 'Test: incoming fire hits harder.'},
    },
    test_rule_heal_on_pickup: {
      ru: {name: 'Лечение', description: 'Тест: поднятие предмета лечит.'},
      en: {name: 'Heal', description: 'Test: picking up an item heals.'},
    },
  },
}));

vi.mock('@content/texts/lookup', () => {
  // Динамический доступ по строковым ключам — через свободную типизацию.
  const lookupSource: TestTextMap = testTexts;
  return {
    getTagText: (tag: string) => ({name: `[${tag}]`}),
    getContentText: (category: string, id: string, locale: string) => {
      const entry = lookupSource[category]?.[id];
      const text = (locale === 'en' ? entry?.en : undefined) ?? entry?.ru;
      // Повторяем поведение настоящего lookup: неизвестный id — маркер-заглушка.
      return text ?? {name: `[${id}]`};
    },
  };
});

// ─────────────────────────────────────────────
// Синтетические шаблоны реликвий
// ─────────────────────────────────────────────

/** Минимальный шаблон реликвии с разумными дефолтами. */
function mockRelicTemplate(
  overrides: Partial<RelicTemplate> & {id: string},
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

/** Тестовые ruleIds реликвии «уголёк» — значения фикстуры, а не реальных правил. */
const EMBER_RULE_IDS = ['test_rule_fire_infusion', 'test_rule_fire_vulnerability'];

const EMBER_ICON = '/assets/relics/relic_test_ember.png';
const EMBER_FALLBACK = '🧪';
const EMBER_RARITY = 'rare';

/** Значение тестового модификатора maxHp (не совпадает с реальными шаблонами). */
const PACT_MAX_HP_MODIFIER = -7;

function createTestRelics(): Map<string, RelicTemplate> {
  return new Map([
    ['relic_test_ember', mockRelicTemplate({
      id: 'relic_test_ember',
      ruleIds: [...EMBER_RULE_IDS],
      rarity: EMBER_RARITY,
      icon: EMBER_ICON,
      fallback: EMBER_FALLBACK,
    })],
    ['relic_test_charm', mockRelicTemplate({id: 'relic_test_charm', stackable: true})],
    ['relic_test_pact', mockRelicTemplate({
      id: 'relic_test_pact',
      ruleIds: ['test_rule_heal_on_pickup'],
      statModifiers: [{stat: 'maxHp', value: PACT_MAX_HP_MODIFIER, op: 'add'}],
    })],
  ]);
}

// ─────────────────────────────────────────────
// Динамически переимпортируемые модули (см. шапку файла)
// ─────────────────────────────────────────────

let GameSessionClass: typeof GameSession;
let registry: typeof import('../../../src/content/registry');
let fixtures: typeof import('../../fixtures/gameState');

describe('GameSession — ViewModel коллекции реликвий', () => {
  beforeEach(async () => {
    vi.resetModules();
    registry = await import('../../../src/content/registry');
    fixtures = await import('../../fixtures/gameState');
    ({GameSession: GameSessionClass} = await import('../../../src/presentation/gameSession'));

    registry.resetRegistry();
    registry.initRegistry(fixtures.createObjectContent({relics: createTestRelics()}));
  });

  afterEach(() => {
    registry.resetRegistry();
  });

  function createSessionWithRelics(relics: RelicInstance[]): GameSession {
    const player = fixtures.makePlayer({relics});
    const state = fixtures.makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });
    const session = new GameSessionClass();
    session.loadGame(state);
    return session;
  }

  it('пустая коллекция даёт пустой массив', () => {
    const session = createSessionWithRelics([]);
    expect(session.getViewModel().renderInput?.relics).toEqual([]);
  });

  it('группирует одинаковые реликвии в стак, порядок — по первому получению', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_test_charm'},
      {instanceId: 'relic_2', templateId: 'relic_test_ember'},
      {instanceId: 'relic_3', templateId: 'relic_test_charm'},
    ]);
    const relics = session.getViewModel().renderInput?.relics ?? [];
    expect(relics.map(r => r.templateId)).toEqual(['relic_test_charm', 'relic_test_ember']);
    expect(relics[0]?.count).toBe(2);
    expect(relics[1]?.count).toBe(1);
  });

  it('переносит в VM локализацию, эффекты, иконку, редкость и рамку', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_test_ember'},
    ]);
    const relic = session.getViewModel().renderInput?.relics?.[0];
    expect(relic?.name).toBe(testTexts.relics.relic_test_ember.ru.name);
    expect(relic?.effects.map(e => e.key)).toEqual(EMBER_RULE_IDS);
    expect(relic?.effects[0]?.text).toBe(testTexts.rules.test_rule_fire_infusion.ru.description);
    expect(relic?.flavorText).toBe(testTexts.relics.relic_test_ember.ru.flavorText);
    expect(relic?.icon).toBe(EMBER_ICON);
    expect(relic?.fallback).toBe(EMBER_FALLBACK);
    expect(relic?.rarity).toBe(EMBER_RARITY);
    expect(relic?.frameUrl).toBe(`/assets/items/loot_frame_${EMBER_RARITY}.png`);
  });

  it('добавляет в effects пункт модификатора характеристики после правил', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_test_pact'},
    ]);
    const relic = session.getViewModel().renderInput?.relics?.[0];
    expect(relic?.effects.map(e => e.key)).toEqual([
      'test_rule_heal_on_pickup',
      'stat_maxHp',
    ]);
    const modifier = relic?.effects[1];
    expect(modifier?.text).toBe(`Макс. здоровье: −${Math.abs(PACT_MAX_HP_MODIFIER)}`);
  });

  it('пропускает реликвии с неизвестным шаблоном', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_unknown'},
      {instanceId: 'relic_2', templateId: 'relic_test_charm'},
    ]);
    const relics = session.getViewModel().renderInput?.relics ?? [];
    expect(relics.map(r => r.templateId)).toEqual(['relic_test_charm']);
  });
});
