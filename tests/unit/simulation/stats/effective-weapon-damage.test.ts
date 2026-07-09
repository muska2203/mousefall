import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate } from '@content/schemas';
import {
  getEffectiveWeaponDamage,
} from '@simulation/systems/stats/effective-stats.ts';
import {
  getPrimaryDamageTag,
  getWeaponWeightForTag,
} from '@simulation/systems/tags/weapon-tags.ts';
import { makeGameState, makePlayer } from '../../../fixtures/gameState.ts';
import { createTestSimulation } from '../../../helpers/simulation.ts';

function mockWeapon(id: string, overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    ...overrides,
  } as ItemTemplate;
}

describe('effective weapon damage helpers', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['test_sword', mockWeapon('test_sword', {
          weapon: {
            baseDamage: 5,
            damageFormulaId: 'sword',
            range: 1,
            damageDistribution: [
              { damageTag: 'damage.physical.slashing', weight: 2.0 },
              { damageTag: 'damage.physical.piercing', weight: 1.0 },
            ],
            tags: ['attack.melee', 'target.single', 'delivery.weapon'],
          },
        })],
        ['test_bow', mockWeapon('test_bow', {
          weapon: {
            baseDamage: 5,
            damageFormulaId: 'dagger',
            range: 2,
            damageDistribution: [
              { damageTag: 'damage.physical.piercing', weight: 1.0 },
            ],
            tags: ['attack.ranged', 'target.single', 'delivery.weapon'],
          },
        })],
        ['test_equal', mockWeapon('test_equal', {
          weapon: {
            baseDamage: 5,
            damageFormulaId: 'sword',
            range: 1,
            damageDistribution: [
              { damageTag: 'damage.physical.slashing', weight: 1.0 },
              { damageTag: 'damage.physical.blunt', weight: 1.0 },
            ],
            tags: ['attack.melee', 'target.single', 'delivery.weapon'],
          },
        })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  describe('getEffectiveWeaponDamage', () => {
    it('без модификаторов возвращает базовый урон оружия', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        equippedWeaponId: 'test_sword',
      });
      expect(getEffectiveWeaponDamage(player)).toBe(5);
    });

    it('с модификаторами damage учитывает multiply перед add', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        equippedWeaponId: 'test_sword',
        statModifiers: [
          { stat: 'damage', value: 0.5, op: 'multiply', source: 'buff' },
          { stat: 'damage', value: 3, op: 'add', source: 'focus' },
        ],
      });
      // base 5 -> 5 * 1.5 + 3 = 10.5 -> округление до 11
      expect(getEffectiveWeaponDamage(player)).toBe(11);
    });
  });

  describe('getPrimaryDamageTag', () => {
    it('выбирает тег с максимальным весом', () => {
      const player = makePlayer({ equippedWeaponId: 'test_sword' });
      expect(getPrimaryDamageTag(player)).toBe('damage.physical.slashing');
    });

    it('при равных весах выбирает первый тег из распределения', () => {
      const player = makePlayer({ equippedWeaponId: 'test_equal' });
      expect(getPrimaryDamageTag(player)).toBe('damage.physical.slashing');
    });
  });

  describe('getWeaponWeightForTag', () => {
    it('возвращает правильный вес для существующего тега', () => {
      const player = makePlayer({ equippedWeaponId: 'test_sword' });
      expect(getWeaponWeightForTag(player, 'damage.physical.slashing')).toBe(2.0);
      expect(getWeaponWeightForTag(player, 'damage.physical.piercing')).toBe(1.0);
    });

    it('возвращает 0 для отсутствующего тега', () => {
      const player = makePlayer({ equippedWeaponId: 'test_sword' });
      expect(getWeaponWeightForTag(player, 'damage.magical.fire')).toBe(0);
    });
  });

  describe('getWeaponDamageByTag', () => {
    it('считает effectiveDamage * weight для выбранного тега', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        equippedWeaponId: 'test_sword',
      });
      const state = makeGameState();
      state.player = player;
      state.entities.set(player.id, player);
      const sim = createTestSimulation(state);

      expect(sim.getWeaponDamageByTag(player, 'damage.physical.slashing')).toBe(10);
    });

    it('возвращает 0, если тег отсутствует в распределении оружия', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        equippedWeaponId: 'test_bow',
      });
      const state = makeGameState();
      state.player = player;
      state.entities.set(player.id, player);
      const sim = createTestSimulation(state);

      expect(sim.getWeaponDamageByTag(player, 'damage.physical.slashing')).toBe(0);
    });
  });
});
