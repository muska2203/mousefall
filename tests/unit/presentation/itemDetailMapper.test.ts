import { beforeAll, describe, expect, it } from 'vitest';
import '@i18n/config';
import { mapItemTemplateToDetail } from '../../../src/presentation/itemDetailMapper';
import type { LocalizedItemTemplate } from '../../../src/content/registry';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { createObjectContent } from '../../fixtures/gameState';
import type { ModifierTemplate } from '../../../src/content/schemas';

/**
 * Синтетические модификаторы для проверки маппинга polarity (независимость от
 * балансных данных контента). Id совпадают с реальными, чтобы тексты брались
 * из статических контентных текстов.
 */
const testModifiers = new Map<string, ModifierTemplate>([
  ['mod_guardian_vitality', {
    id: 'mod_guardian_vitality',
    polarity: 'positive',
    effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
    scaling: { kind: 'fixed', value: 10 },
    applicableSubtypes: ['heavy'],
    poolEligible: false,
    weight: 1,
  }],
  ['mod_sturdy_armor', {
    id: 'mod_sturdy_armor',
    polarity: 'positive',
    effect: { kind: 'stat', stat: 'armor', op: 'add' },
    scaling: { kind: 'perLevel', ranges: [{ min: 1, max: 2 }] },
    applicableSubtypes: ['light', 'heavy'],
    poolEligible: true,
    weight: 1,
  }],
  ['mod_dull', {
    id: 'mod_dull',
    polarity: 'negative',
    effect: { kind: 'stat', stat: 'damage', op: 'add' },
    scaling: { kind: 'perLevel', ranges: [{ min: -2, max: -1 }] },
    applicableSubtypes: ['sword'],
    poolEligible: true,
    weight: 1,
  }],
]);

describe('mapItemTemplateToDetail', () => {
  beforeAll(() => {
    resetRegistry();
    initRegistry(createObjectContent({ modifiers: testModifiers }));
  });
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
      fixedModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 5, max: 5 },
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
      fixedModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 5, max: 5 },
        range: 1,
        damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
        tags: [],
      },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');
    const combatSection = vm.sections.find((section) => section.kind === 'stat-list' && section.title === 'Боевые параметры');

    expect(combatSection).toBeDefined();
    expect(combatSection!.kind === 'stat-list' ? combatSection!.stats : []).toEqual([
      { label: 'Рубящий (Базовый)', value: '5' },
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
      fixedModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 20, max: 20 },
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
      { label: 'Рубящий (Базовый)', value: '14' },
      { label: 'Колющий (Базовый)', value: '4' },
      { label: 'Дробящий (Базовый)', value: '2' },
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
      fixedModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 5, max: 5 },
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
      fixedModifiers: [],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      consumable: { effect: 'heal', value: 20 },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.tags).toEqual([]);
  });

  it('maps instance affixes into properties keeping fixed-before-rolled order', () => {
    const template: LocalizedItemTemplate = {
      id: 'cat_guardian_plate',
      name: 'Латы стражника',
      description: 'Тяжёлые латы.',
      type: 'armor',
      spriteId: 'cat_guardian_plate',
      stackable: false,
      maxStack: 1,
      value: 30,
      rarity: 'unique',
      fixedModifiers: ['mod_guardian_vitality'],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
      armor: { baseArmor: 4 },
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {
      affixes: [
        { modifierId: 'mod_guardian_vitality', value: 10, origin: 'fixed' },
        { modifierId: 'mod_sturdy_armor', value: 3, origin: 'rolled' },
        { modifierId: 'mod_dull', value: -2, origin: 'rolled' },
      ],
    }, 'ru');

    expect(vm.properties).toEqual([
      {
        key: 'mod_guardian_vitality',
        name: 'Стражникова',
        description: 'Максимум здоровья: +10.',
        origin: 'fixed',
        polarity: 'positive',
      },
      {
        key: 'mod_sturdy_armor',
        name: 'Крепкая',
        description: 'Броня увеличена на 3.',
        origin: 'rolled',
        polarity: 'positive',
      },
      {
        key: 'mod_dull',
        name: 'Тупое',
        description: 'Урон: -2.',
        origin: 'rolled',
        polarity: 'negative',
      },
    ]);
  });

  it('maps fixedModifiers into localized properties for template view', () => {
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
      fixedModifiers: ['mod_amulet_fire_damage_multiplier'],
      abilityPool: [],
      grantedAbilities: [],
      apCost: 1,
    } as unknown as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, { isTemplate: true }, 'ru');

    expect(vm.properties).toEqual([
      {
        key: 'mod_amulet_fire_damage_multiplier',
        name: 'Угольная',
        description: 'Огненные атаки оружием или способностью наносят на 2 урона больше.',
        origin: 'fixed',
        polarity: 'positive',
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
      fixedModifiers: [],
      abilityPool: [
        { abilityId: 'fireball', weight: 1 },
        { abilityId: 'magic_slap', weight: 1 },
      ],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 2, max: 2 },
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
      fixedModifiers: [],
      abilityPool: [
        { abilityId: 'fireball', weight: 1 },
        { abilityId: 'magic_slap', weight: 1 },
      ],
      grantedAbilities: [],
      apCost: 1,
      weapon: {
        damage: { min: 2, max: 2 },
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
