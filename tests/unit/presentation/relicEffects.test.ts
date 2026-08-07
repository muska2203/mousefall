/**
 * Тесты билдера эффектов реликвии (buildRelicEffects, presentation/relicDetailMapper).
 *
 * Проверяет:
 * - пункты правил с однострочными описаниями (тексты подменены на уровне lookup —
 *   тест не зависит от строк texts/{ru,en}/rules.ts и реальных ruleIds);
 * - пункты модификаторов характеристик: локализация имён статов (ru/en, i18n UI)
 *   и однострочный формат «Имя: +N» / «Имя: −N» / «Имя: ×N»;
 * - порядок: сначала правила, затем модификаторы.
 *
 * Все значения в assert'ах происходят из фикстур этого файла.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18next from 'i18next';
import '@i18n/config';
import type {RelicTemplate} from '../../../src/content/schemas';
import type {ContentText} from '../../../src/content/texts/types';

// ─────────────────────────────────────────────
// Тестовые тексты правил: подменяют texts/{ru,en}/rules.ts на уровне lookup
// ─────────────────────────────────────────────

type TestTextMap = Record<string, Record<string, {ru: ContentText; en?: ContentText}>>;

// Тип выводится из литерала: конкретные ключи фикстур доступны без undefined.
const testTexts = vi.hoisted(() => ({
  rules: {
    test_rule_poison_on_hit: {
      ru: {name: 'Яд', description: 'Тест: удары оружия отравляют цель.'},
      en: {name: 'Poison', description: 'Test: weapon hits poison the target.'},
    },
    test_rule_ramp_up: {
      ru: {name: 'Разгон', description: 'Тест: по неотравленной цели урон меньше.'},
      en: {name: 'Ramp up', description: 'Test: less damage to unpoisoned targets.'},
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

import {buildRelicEffects} from '../../../src/presentation/relicDetailMapper';

function makeRelic(overrides: Partial<RelicTemplate> = {}): RelicTemplate {
  return {
    id: 'relic_test',
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
    ...overrides,
  };
}

describe('buildRelicEffects', () => {
  beforeEach(async () => {
    await i18next.changeLanguage('ru');
  });

  afterEach(async () => {
    await i18next.changeLanguage('ru');
  });

  it('собирает пункты правил с однострочными описаниями из текстов', () => {
    const relic = makeRelic({
      ruleIds: ['test_rule_poison_on_hit', 'test_rule_ramp_up'],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {
        key: 'test_rule_poison_on_hit',
        text: testTexts.rules.test_rule_poison_on_hit.ru.description,
      },
      {
        key: 'test_rule_ramp_up',
        text: testTexts.rules.test_rule_ramp_up.ru.description,
      },
    ]);
  });

  it('зеркалит тексты правил в en-локали', () => {
    const relic = makeRelic({ruleIds: ['test_rule_poison_on_hit']});
    const effects = buildRelicEffects(relic, 'en');
    expect(effects[0]?.text).toBe(testTexts.rules.test_rule_poison_on_hit.en?.description);
  });

  it('подставляет пустую строку для правила без описания', () => {
    const relic = makeRelic({ruleIds: ['test_rule_without_text']});
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([{key: 'test_rule_without_text', text: ''}]);
  });

  it('форматирует add-модификаторы: «Имя: +N» и «Имя: −N»', () => {
    const relic = makeRelic({
      statModifiers: [
        {stat: 'damage', value: 3, op: 'add'},
        {stat: 'armor', value: -1, op: 'add'},
      ],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {key: 'stat_damage', text: 'Урон: +3'},
      {key: 'stat_armor', text: 'Броня: −1'},
    ]);
  });

  it('форматирует multiply-модификаторы: «Имя: ×N»', () => {
    const relic = makeRelic({
      statModifiers: [{stat: 'critMultiplier', value: 1.5, op: 'multiply'}],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {key: 'stat_critMultiplier', text: 'Множитель крита: ×1.5'},
    ]);
  });

  it('локализует имена характеристик в en', async () => {
    await i18next.changeLanguage('en');
    const relic = makeRelic({
      statModifiers: [{stat: 'maxHp', value: -5, op: 'add'}],
    });
    const effects = buildRelicEffects(relic, 'en');
    expect(effects).toEqual([
      {key: 'stat_maxHp', text: 'Max HP: −5'},
    ]);
  });

  it('ставит правила перед модификаторами характеристик', () => {
    const relic = makeRelic({
      ruleIds: ['test_rule_heal_on_pickup'],
      statModifiers: [{stat: 'maxHp', value: -5, op: 'add'}],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects.map(e => e.key)).toEqual([
      'test_rule_heal_on_pickup',
      'stat_maxHp',
    ]);
  });

  it('пустая реликвия даёт пустой список эффектов', () => {
    expect(buildRelicEffects(makeRelic(), 'ru')).toEqual([]);
  });
});
