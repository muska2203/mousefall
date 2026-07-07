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
      weapon: {
        damageType: 'slashing',
        baseDamage: 5,
        damageFormulaId: 'str',
        tags: ['attack.melee', 'delivery.weapon'],
      },
    } as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.tags).toEqual(['attack.melee', 'delivery.weapon']);
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
      consumable: { effect: 'heal', value: 20 },
    } as LocalizedItemTemplate;

    const vm = mapItemTemplateToDetail(template, {}, 'ru');

    expect(vm.tags).toEqual([]);
  });
});
