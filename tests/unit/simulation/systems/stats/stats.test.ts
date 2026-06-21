import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate } from '@content/schemas';
import { makePlayer, makeEnemy } from '../../../../fixtures/gameState.ts';
import {
  getBaseMaxHp,
  getBaseDamage,
  getBaseArmor,
  getBaseDodgeChance,
  getBaseAccuracy,
  getBaseCritChance,
  getBaseCritMultiplier,
} from '@simulation/systems/stats/base-resolver.ts';
import {
  applyModifiers,
  addModifier,
  removeModifiersBySource,
  consumeCharge,
} from '@simulation/systems/stats/modifier-engine.ts';
import {
  getEffectiveDamage,
  getEffectiveArmor,
  getEffectiveMaxHp,
} from '@simulation/systems/stats/effective-stats.ts';
import { recalculateActorStats } from '@simulation/systems/stats/recalculate.ts';

function mockItem(id: string, template: Partial<ItemTemplate>): ItemTemplate {
  return {
    id,
    type: 'consumable',
    stackable: false,
    maxStack: 1,
    value: 0,
    ...template,
  } as ItemTemplate;
}

describe('stats system', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['test_sword', mockItem('test_sword', {
          type: 'weapon',
          weapon: { baseDamage: 5, damageFormulaId: 'sword', range: 1, damageType: 'slashing' },
        })],
        ['test_armor', mockItem('test_armor', {
          type: 'armor',
          armor: { baseArmor: 4 },
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

  // ─────────────────────────────────────────────
  // Base Resolver
  // ─────────────────────────────────────────────

  describe('base resolver', () => {
    it('calculates maxHp from vit', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 5 } });
      expect(getBaseMaxHp(player)).toBe(50 + 5 * 10); // 100
    });

    it('calculates unarmed damage from str', () => {
      const player = makePlayer({ baseStats: { str: 3, dex: 0, int: 0, vit: 0 } });
      expect(getBaseDamage(player)).toBe(1 + 3 * 1.0); // 4
    });

    it('calculates weapon damage with formula', () => {
      const player = makePlayer({
        baseStats: { str: 4, dex: 2, int: 0, vit: 0 },
        equippedWeaponId: 'test_sword',
      });
      // sword: baseDamage + str*0.8 + dex*0.5 = 5 + 3.2 + 1.0 = 9.2 -> округляется до 9
      expect(getBaseDamage(player)).toBe(9);
    });

    it('calculates armor from equipped armor', () => {
      const player = makePlayer({ equippedArmorId: 'test_armor' });
      expect(getBaseArmor(player)).toBe(4);
    });

    it('calculates armor as 0 when no armor', () => {
      const player = makePlayer({ equippedArmorId: null });
      expect(getBaseArmor(player)).toBe(0);
    });

    it('calculates dodgeChance from dex', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      expect(getBaseDodgeChance(player)).toBe(0.2);
    });

    it('calculates accuracy from dex', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      expect(getBaseAccuracy(player)).toBe(0.15);
    });

    it('calculates critChance from dex', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      expect(getBaseCritChance(player)).toBe(0.1);
    });

    it('returns base critMultiplier', () => {
      const player = makePlayer();
      expect(getBaseCritMultiplier(player)).toBe(1.5);
    });
  });

  // ─────────────────────────────────────────────
  // Modifier Engine
  // ─────────────────────────────────────────────

  describe('modifier engine', () => {
    it('applies add modifiers', () => {
      const player = makePlayer();
      player.statModifiers = [{ stat: 'damage', value: 5, op: 'add', source: 'buff' }];
      expect(applyModifiers(player, 'damage', 10).total).toBe(15);
    });

    it('applies multiply modifiers before add', () => {
      const player = makePlayer();
      player.statModifiers = [
        { stat: 'damage', value: 0.5, op: 'multiply', source: 'buff1' },
        { stat: 'damage', value: 3, op: 'add', source: 'buff2' },
      ];
      // (10 * 1.5) + 3 = 18
      expect(applyModifiers(player, 'damage', 10).total).toBe(18);
    });

    it('stacks multiple multiply modifiers additively', () => {
      const player = makePlayer();
      player.statModifiers = [
        { stat: 'damage', value: 0.2, op: 'multiply', source: 'a' },
        { stat: 'damage', value: 0.3, op: 'multiply', source: 'b' },
      ];
      // 10 * (1 + 0.2 + 0.3) = 15
      expect(applyModifiers(player, 'damage', 10).total).toBe(15);
    });

    it('does not apply unrelated modifiers', () => {
      const player = makePlayer();
      player.statModifiers = [{ stat: 'armor', value: 5, op: 'add', source: 'buff' }];
      expect(applyModifiers(player, 'damage', 10).total).toBe(10);
    });

    it('clamps to 0 minimum', () => {
      const player = makePlayer();
      player.statModifiers = [{ stat: 'damage', value: -100, op: 'add', source: 'debuff' }];
      expect(applyModifiers(player, 'damage', 10).total).toBe(0);
    });

    it('addModifier prevents duplicates by source and updates charges', () => {
      const player = makePlayer();
      addModifier(player, { stat: 'damage', value: 5, op: 'add', source: 'rage', charges: 2 });
      addModifier(player, { stat: 'damage', value: 5, op: 'add', source: 'rage', charges: 3 });
      expect(player.statModifiers).toHaveLength(1);
      expect(player.statModifiers[0]!.charges).toBe(5);
    });

    it('addModifier replaces value for non-charge modifiers', () => {
      const player = makePlayer();
      addModifier(player, { stat: 'damage', value: 5, op: 'add', source: 'buff' });
      addModifier(player, { stat: 'damage', value: 8, op: 'add', source: 'buff' });
      expect(player.statModifiers[0]!.value).toBe(8);
    });

    it('removeModifiersBySource cleans all matching', () => {
      const player = makePlayer();
      player.statModifiers = [
        { stat: 'damage', value: 5, op: 'add', source: 'item_ring' },
        { stat: 'armor', value: 2, op: 'add', source: 'item_ring' },
      ];
      removeModifiersBySource(player, 'item_ring');
      expect(player.statModifiers).toHaveLength(0);
    });

    it('consumeCharge spends charge and removes at 0', () => {
      const player = makePlayer();
      addModifier(player, { stat: 'damage', value: 10, op: 'add', source: 'focus', charges: 1 });
      const spent = consumeCharge(player, 'damage');
      expect(spent).toBe(true);
      expect(player.statModifiers).toHaveLength(0);
    });

    it('consumeCharge decrements charge above 1', () => {
      const player = makePlayer();
      addModifier(player, { stat: 'damage', value: 10, op: 'add', source: 'focus', charges: 3 });
      consumeCharge(player, 'damage');
      expect(player.statModifiers[0]!.charges).toBe(2);
    });

    it('consumeCharge returns false if no matching modifier', () => {
      const player = makePlayer();
      expect(consumeCharge(player, 'damage')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // Effective Stats
  // ─────────────────────────────────────────────

  describe('effective stats', () => {
    it('returns base damage + modifiers for player', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 0 } });
      // unarmed: 1 + 0 = 1
      player.statModifiers = [{ stat: 'damage', value: 4, op: 'add', source: 'buff' }];
      expect(getEffectiveDamage(player)).toBe(5);
    });

    it('returns derived damage for enemies with baseStats', () => {
      // unarmed: 1 + str * 1.0 = 1 + 2 = 3
      const enemy = makeEnemy({ baseStats: { str: 2, dex: 0, int: 0, vit: 0 }, equippedWeaponId: null });
      expect(getEffectiveDamage(enemy)).toBe(3);
    });

    it('returns base armor + modifiers for player', () => {
      const player = makePlayer({ equippedArmorId: 'test_armor' });
      player.statModifiers = [{ stat: 'armor', value: 2, op: 'add', source: 'buff' }];
      expect(getEffectiveArmor(player)).toBe(6);
    });

    it('returns derived armor for enemies with baseStats', () => {
      const enemy = makeEnemy({ equippedArmorId: null, statModifiers: [{ stat: 'armor', value: 3, op: 'add', source: 'test' }] });
      expect(getEffectiveArmor(enemy)).toBe(3);
    });

    it('effective maxHp includes modifiers', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 5 } });
      // base = 100
      player.statModifiers = [{ stat: 'maxHp', value: 20, op: 'add', source: 'buff' }];
      expect(getEffectiveMaxHp(player)).toBe(120);
    });

  });

  // ─────────────────────────────────────────────
  // Recalculate
  // ─────────────────────────────────────────────

  describe('recalculateActorStats', () => {
    it('updates maxHp, damage, armor', () => {
      const player = makePlayer({
        baseStats: { str: 2, dex: 0, int: 2, vit: 3 },
        equippedWeaponId: null,
        equippedArmorId: null,
      });
      recalculateActorStats(player);
      expect(player.maxHp).toBe(50 + 3 * 10); // 80
      expect(player.damage).toBe(1 + 2 * 1.0); // 3 (unarmed)
      expect(player.armor).toBe(0);
    });

    it('clamps hp to new maximum', () => {
      const player = makePlayer({
        hp: 200,
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
      });
      recalculateActorStats(player);
      expect(player.hp).toBe(50); // clamped to maxHp (50 + 0*10)
    });

    it('applies equipModifiers from items to baseStats', () => {
      const player = makePlayer({
        baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
        statModifiers: [{ stat: 'str', value: 3, op: 'add', source: 'item_test' }],
      });
      recalculateActorStats(player);
      // effective str = 8, so maxHp = 50 + vit*10 = 50, damage = 1 + 8*1.0 = 9
      expect(player.damage).toBe(9);
    });

    it('updates secondary derived stats (dodge, accuracy, crit)', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 10, int: 0, vit: 0 },
      });
      recalculateActorStats(player);
      expect(player.dodgeChance).toBeCloseTo(0.2);
      expect(player.accuracy).toBeCloseTo(0.15);
      expect(player.critChance).toBeCloseTo(0.1);
      expect(player.critMultiplier).toBe(1.5);
    });

    it('includes modifiers in secondary stats after recalculate', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 10, int: 0, vit: 0 },
        statModifiers: [{ stat: 'critChance', value: 0.05, op: 'add', source: 'buff' }],
      });
      recalculateActorStats(player);
      expect(player.critChance).toBeCloseTo(0.15); // 0.1 + 0.05
    });
  });

  describe('auto-recalculate on modifier changes', () => {
    it('addModifier requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      addModifier(player, { stat: 'dex', value: 10, op: 'add', source: 'buff' });
      recalculateActorStats(player);
      // effective dex = 20 -> dodgeChance = 0.4
      expect(player.dodgeChance).toBeCloseTo(0.4);
    });

    it('removeModifiersBySource requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      addModifier(player, { stat: 'dex', value: 10, op: 'add', source: 'buff' });
      recalculateActorStats(player);
      expect(player.dodgeChance).toBeCloseTo(0.4);
      removeModifiersBySource(player, 'buff');
      recalculateActorStats(player);
      expect(player.dodgeChance).toBeCloseTo(0.2);
    });

    it('consumeCharge removes modifier and requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 10, int: 0, vit: 0 } });
      addModifier(player, { stat: 'dex', value: 10, op: 'add', source: 'temp', charges: 1 });
      recalculateActorStats(player);
      expect(player.dodgeChance).toBeCloseTo(0.4);
      consumeCharge(player, 'dex');
      recalculateActorStats(player);
      expect(player.dodgeChance).toBeCloseTo(0.2);
    });
  });
});
