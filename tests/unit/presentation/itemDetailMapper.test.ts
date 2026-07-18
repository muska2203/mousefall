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

  it('maps item ruleIds into localized properties', () => {
    const template: LocalizedItemTemplate = {
      id: 'common_ember_amulet',
      name: 'Тусклый угольный амулет',
      description: 'Хранит угасающую искру.',
      type: 'amulet',
      spriteId: 'common_ember_amulet',
      stackable: false,
      maxStack: 1,
      value: 6,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      ruleIds: ['amulet_fire_damage_multiplier'],
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.properties).toEqual([
      {
        ruleId: 'amulet_fire_damage_multiplier',
        name: 'Угольная искра',
        description: 'Весь огненный урон увеличивается на 15%.',
      },
    ]);
  });

  it('returns null abilityPool and isTemplate=false by default', () => {
    const template: LocalizedItemTemplate = {
      id: 'common_school_wand',
      name: 'Школьная палочка',
      description: 'Простая палочка.',
      type: 'weapon',
      spriteId: 'common_school_wand',
      stackable: false,
      maxStack: 1,
      value: 10,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [
        { abilityId: 'fireball', weight: 1 },
        { abilityId: 'magic_slap', weight: 1 },
      ],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 2,
        damageFormulaId: 'staff',
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.isTemplate).toBe(false);
    expect(vm.abilityPool).toBeNull();
  });

  it('exposes abilityPool and isTemplate=true for template view', () => {
    const template: LocalizedItemTemplate = {
      id: 'common_school_wand',
      name: 'Школьная палочка',
      description: 'Простая палочка.',
      type: 'weapon',
      spriteId: 'common_school_wand',
      stackable: false,
      maxStack: 1,
      value: 10,
      rarity: 'common',
      equipModifiers: [],
      abilityPool: [
        { abilityId: 'fireball', weight: 1 },
        { abilityId: 'magic_slap', weight: 1 },
      ],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        baseDamage: 2,
        damageFormulaId: 'staff',
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, { isTemplate: true }, 'ru');

    expect(vm.isTemplate).toBe(true);
    expect(vm.abilityPool).not.toBeNull();
    expect(vm.abilityPool).toHaveLength(2);
    expect(vm.abilityPool!.map((a) => a.abilityId)).toContain('fireball');
    expect(vm.abilityPool!.map((a) => a.abilityId)).toContain('magic_slap');
  });
});
