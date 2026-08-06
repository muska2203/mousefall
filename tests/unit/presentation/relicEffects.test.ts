/**
 * Тесты билдера эффектов реликвии (buildRelicEffects, presentation/relicDetailMapper).
 *
 * Проверяет:
 * - пункты правил с именами/описаниями из texts/{ru,en}/rules.ts (на реальном контенте);
 * - пункты модификаторов характеристик: локализация имён статов (ru/en)
 *   и формат значений («+N», «−N», «×N»);
 * - порядок: сначала правила, затем модификаторы.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import i18next from 'i18next';
import '@i18n/config';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import {buildContent} from '../../../src/content/templates';
import type {RelicTemplate} from '../../../src/content/schemas';
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
    resetRegistry();
    initRegistry(buildContent());
    await i18next.changeLanguage('ru');
  });

  afterEach(async () => {
    resetRegistry();
    await i18next.changeLanguage('ru');
  });

  it('собирает пункты правил с именами и описаниями из текстов', () => {
    const relic = makeRelic({
      ruleIds: ['relic_venom_gland_poison_on_hit', 'relic_venom_gland_ramp_up'],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {
        key: 'relic_venom_gland_poison_on_hit',
        name: 'Отравляющий удар',
        description: 'Удары [оружия](tag:delivery.weapon) отравляют цель на 3 хода.',
      },
      {
        key: 'relic_venom_gland_ramp_up',
        name: 'Разгон',
        description: 'По неотравленной цели урон [оружия](tag:delivery.weapon) на 1 меньше.',
      },
    ]);
  });

  it('зеркалит тексты правил в en-локали', () => {
    const relic = makeRelic({ruleIds: ['relic_venom_gland_poison_on_hit']});
    const effects = buildRelicEffects(relic, 'en');
    expect(effects[0]?.name).toBe('Poisoning Strike');
    expect(effects[0]?.description).toContain('poison the target for 3 turns');
  });

  it('форматирует add-модификаторы: «+N» и «−N»', () => {
    const relic = makeRelic({
      statModifiers: [
        {stat: 'damage', value: 3, op: 'add'},
        {stat: 'armor', value: -1, op: 'add'},
      ],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {key: 'stat_damage', name: 'Урон', description: '+3'},
      {key: 'stat_armor', name: 'Броня', description: '−1'},
    ]);
  });

  it('форматирует multiply-модификаторы: «×N»', () => {
    const relic = makeRelic({
      statModifiers: [{stat: 'critMultiplier', value: 1.5, op: 'multiply'}],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects).toEqual([
      {key: 'stat_critMultiplier', name: 'Множитель крита', description: '×1.5'},
    ]);
  });

  it('локализует имена характеристик в en', async () => {
    await i18next.changeLanguage('en');
    const relic = makeRelic({
      statModifiers: [{stat: 'maxHp', value: -5, op: 'add'}],
    });
    const effects = buildRelicEffects(relic, 'en');
    expect(effects).toEqual([
      {key: 'stat_maxHp', name: 'Max HP', description: '−5'},
    ]);
  });

  it('ставит правила перед модификаторами характеристик', () => {
    const relic = makeRelic({
      ruleIds: ['relic_scavenger_heal_on_pickup'],
      statModifiers: [{stat: 'maxHp', value: -5, op: 'add'}],
    });
    const effects = buildRelicEffects(relic, 'ru');
    expect(effects.map(e => e.key)).toEqual([
      'relic_scavenger_heal_on_pickup',
      'stat_maxHp',
    ]);
  });

  it('пустая реликвия даёт пустой список эффектов', () => {
    expect(buildRelicEffects(makeRelic(), 'ru')).toEqual([]);
  });
});
