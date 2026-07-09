import { describe, expect, it } from 'vitest';
import '@i18n/config';
import { mapItemTemplateToDetail } from '../../../src/presentation/itemDetailMapper';
import type { LocalizedItemTemplate } from '../../../src/content/registry';

describe('mapItemTemplateToDetail', () => {
  it('copies weapon tags into view model', () => {
    const template: LocalizedItemTemplate = {
      id: 'sword',
      name: 'Меч',
      description: 'Простой меч',
      type: 'weapon',
      spriteId: 'sword',
      stackable: false,
      maxStack: 1,
      value: 10,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 5,
        damageFormulaId: 'str',
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
        tags: ['attack.melee', 'delivery.weapon'],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.tags).toEqual(['attack.melee', 'delivery.weapon']);
  });

  it('shows single damage type in combat params', () => {
    const template: LocalizedItemTemplate = {
      id: 'sword',
      name: 'Меч',
      description: 'Простой меч',
      type: 'weapon',
      spriteId: 'sword',
      stackable: false,
      maxStack: 1,
      value: 10,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 5,
        damageFormulaId: 'str',
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');
    const combatSection = vm.sections.find((section) => section.kind === 'stat-list' && section.title === 'Боевые параметры');

    expect(combatSection).toBeDefined();
    expect(combatSection!.kind === 'stat-list' ? combatSection!.stats : []).toEqual([
      { label: 'Рубящий (Базовый)', value: 5 },
    ]);
  });

  it('shows all damage types with calculated total damage and localized names', () => {
    const template: LocalizedItemTemplate = {
      id: 'halberd',
      name: 'Алебарда',
      description: 'Универсальное оружие',
      type: 'weapon',
      spriteId: 'halberd',
      stackable: false,
      maxStack: 1,
      value: 30,
      rarity: 'rare',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 20,
        damageFormulaId: 'str',
        range: 1,
        damageDistribution: [
          { damageTag: 'damage.physical.slashing', weight: 0.7 },
          { damageTag: 'damage.physical.piercing', weight: 0.2 },
          { damageTag: 'damage.physical.blunt', weight: 0.1 },
        ],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');
    const combatSection = vm.sections.find((section) => section.kind === 'stat-list' && section.title === 'Боевые параметры');

    expect(combatSection).toBeDefined();
    expect(combatSection!.kind === 'stat-list' ? combatSection!.stats : []).toEqual([
      { label: 'Рубящий (Базовый)', value: 14 },
      { label: 'Колющий (Базовый)', value: 4 },
      { label: 'Дробящий (Базовый)', value: 2 },
    ]);
  });

  it('does not show damage formula in combat params', () => {
    const template: LocalizedItemTemplate = {
      id: 'sword',
      name: 'Меч',
      description: 'Простой меч',
      type: 'weapon',
      spriteId: 'sword',
      stackable: false,
      maxStack: 1,
      value: 10,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 5,
        damageFormulaId: 'str',
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');
    const labels = vm.sections
      .filter((section) => section.kind === 'stat-list')
      .flatMap((section) => (section.kind === 'stat-list' ? section.stats.map((stat) => stat.label) : []));

    expect(labels).not.toContain('Формула');
  });

  it('returns empty tags for non-weapon items', () => {
    const template: LocalizedItemTemplate = {
      id: 'health_potion',
      name: 'Зелье здоровья',
      description: 'Восстанавливает здоровье',
      type: 'consumable',
      spriteId: 'potion',
      stackable: true,
      maxStack: 10,
      value: 5,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      consumable: { effect: 'heal', value: 20 },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.tags).toEqual([]);
  });
});
