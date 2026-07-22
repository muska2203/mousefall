import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { getAbilityTags } from '../../../../src/simulation/systems/tags/ability-tags';
import type { AbilityTemplate } from '../../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    requiredWeaponTags: [],
    tags: ['attack.melee', 'target.single'],
    ...overrides,
  } as AbilityTemplate;
}

describe('getAbilityTags', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['cleave', mockAbility('cleave', {
          tags: ['attack.melee', 'target.aoe', 'delivery.weapon'],
          damageTag: 'damage.physical.slashing',
        })],
        ['sudden_strike', mockAbility('sudden_strike', {
          tags: ['attack.melee', 'target.single', 'delivery.weapon'],
        })],
        ['no_tags', mockAbility('no_tags', { tags: undefined as unknown as string[] })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('возвращает tags + damageTag в конце массива', () => {
    expect(getAbilityTags('cleave')).toEqual([
      'attack.melee',
      'target.aoe',
      'delivery.weapon',
      'damage.physical.slashing',
    ]);
  });

  it('возвращает только tags, если damageTag не задан', () => {
    expect(getAbilityTags('sudden_strike')).toEqual([
      'attack.melee',
      'target.single',
      'delivery.weapon',
    ]);
  });

  it('возвращает пустой массив для несуществующей способности', () => {
    expect(getAbilityTags('missing_ability')).toEqual([]);
  });

  it('не падает, если tags отсутствует (fallback на пустой массив)', () => {
    expect(getAbilityTags('no_tags')).toEqual([]);
  });
});
