import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate } from '@content/schemas';
import { makePlayer, makeEnemy } from '../../../../fixtures/gameState.ts';
import {
  getBaseMaxHp,
  getBaseDamageRange,
  getBaseArmor,
  getBaseCritMultiplier,
} from '@simulation/systems/stats/base-resolver.ts';
import {
  applyModifiers,
  addModifier,
  removeModifiersBySource,
  consumeCharge,
} from '@simulation/systems/stats/modifier-engine.ts';
import {
  getEffectiveWeaponDamageRange,
  getEffectiveArmor,
  getEffectiveMaxHp,
} from '@simulation/systems/stats/effective-stats.ts';
import { getWeaponTags, getWeaponDamageDistribution } from '@simulation/systems/tags/weapon-tags.ts';
import { getWeaponAttackRange } from '@simulation/systems/stats/weapon-range.ts';
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
          weapon: { damage: { min: 5, max: 5 }, range: 1, minRange: 1, damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }], tags: [] },
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
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
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

    it('returns unarmed damage range without weapon', () => {
      const player = makePlayer({ baseStats: { str: 3, dex: 0, int: 0, vit: 0 } });
      expect(getBaseDamageRange(player)).toEqual({ min: 1, max: 1 });
    });

    it('returns weapon damage range from template', () => {
      const player = makePlayer({
        baseStats: { str: 4, dex: 2, int: 0, vit: 0 },
        equippedWeaponId: 'test_sword',
      });
      expect(getBaseDamageRange(player)).toEqual({ min: 5, max: 5 });
    });

    it('calculates armor from equipped armor', () => {
      const player = makePlayer({ equippedArmorId: 'test_armor' });
      expect(getBaseArmor(player)).toBe(4);
    });

    it('calculates armor as 0 when no armor', () => {
      const player = makePlayer({ equippedArmorId: null });
      expect(getBaseArmor(player)).toBe(0);
    });

    it('returns base critMultiplier', () => {
      const player = makePlayer();
      expect(getBaseCritMultiplier(player)).toBe(1.5);
    });
  });

  // ─────────────────────────────────────────────
  // Резолверы врага (прямые статы: attack / baseArmor)
  // ─────────────────────────────────────────────

  describe('enemy profile resolvers', () => {
    const enemyAttack = {
      damage: { min: 3, max: 5 },
      range: 2,
      minRange: 1,
      damageDistribution: [
        { damageTag: 'damage.physical.slashing', weight: 2.0 },
        { damageTag: 'damage.physical.piercing', weight: 1.0 },
      ],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    };

    it('getBaseDamageRange читает attack.damage врага', () => {
      const enemy = makeEnemy({ attack: enemyAttack });
      expect(getBaseDamageRange(enemy)).toEqual({ min: 3, max: 5 });
    });

    it('getBaseArmor читает baseArmor врага', () => {
      const enemy = makeEnemy({ baseArmor: 4 });
      expect(getBaseArmor(enemy)).toBe(4);
    });

    it('getWeaponTags возвращает теги из attack.tags врага (копия, без мутации профиля)', () => {
      const enemy = makeEnemy({ attack: enemyAttack });
      const tags = getWeaponTags(enemy);
      expect(tags).toEqual(['attack.melee', 'target.single', 'delivery.weapon']);
      expect(tags).not.toBe(enemy.attack.tags);
    });

    it('getWeaponDamageDistribution возвращает распределение из attack врага', () => {
      const enemy = makeEnemy({ attack: enemyAttack });
      expect(getWeaponDamageDistribution(enemy)).toEqual([
        { damageTag: 'damage.physical.slashing', weight: 2.0 },
        { damageTag: 'damage.physical.piercing', weight: 1.0 },
      ]);
    });

    it('getWeaponAttackRange читает range/minRange из attack врага', () => {
      const enemy = makeEnemy({ attack: enemyAttack });
      expect(getWeaponAttackRange(enemy)).toEqual({ minRange: 1, range: 2 });
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
    it('returns base damage range + modifiers for player', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 0 } });
      // unarmed: { min: 1, max: 1 }
      player.statModifiers = [{ stat: 'damage', value: 4, op: 'add', source: 'buff' }];
      expect(getEffectiveWeaponDamageRange(player)).toEqual({ min: 5, max: 5 });
    });

    it('returns damage range from enemy attack profile', () => {
      // Прямые статы врага: рейнж читается из профиля attack сущности (без реестра).
      const enemy = makeEnemy({
        attack: {
          damage: { min: 2, max: 4 },
          range: 1,
          minRange: 1,
          damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
          tags: ['attack.melee', 'target.single', 'delivery.weapon'],
        },
      });
      expect(getEffectiveWeaponDamageRange(enemy)).toEqual({ min: 2, max: 4 });
    });

    it('returns base armor + modifiers for player', () => {
      const player = makePlayer({ equippedArmorId: 'test_armor' });
      player.statModifiers = [{ stat: 'armor', value: 2, op: 'add', source: 'buff' }];
      expect(getEffectiveArmor(player)).toBe(6);
    });

    it('returns baseArmor + modifiers for enemies', () => {
      const enemy = makeEnemy({ baseArmor: 2, statModifiers: [{ stat: 'armor', value: 3, op: 'add', source: 'test' }] });
      expect(getEffectiveArmor(enemy)).toBe(5);
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
      expect(player.damage).toEqual({ min: 1, max: 1 }); // unarmed
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
      // Рейнж урона не зависит от статы: без оружия — unarmed {1,1}
      expect(player.damage).toEqual({ min: 1, max: 1 });
    });

    it('updates secondary derived stats', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 10, int: 0, vit: 0 },
      });
      recalculateActorStats(player);
      expect(player.critMultiplier).toBe(1.5);
    });

    it('includes modifiers in secondary stats after recalculate', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 10, int: 0, vit: 0 },
        statModifiers: [{ stat: 'critMultiplier', value: 0.5, op: 'add', source: 'buff' }],
      });
      recalculateActorStats(player);
      expect(player.critMultiplier).toBeCloseTo(2.0); // 1.5 + 0.5
    });

    it('includes maxHp modifiers in derived cache', () => {
      const player = makePlayer({
        hp: 80,
        baseStats: { str: 0, dex: 0, int: 0, vit: 5 },
        statModifiers: [{ stat: 'maxHp', value: -10, op: 'add', source: 'mod' }],
      });
      recalculateActorStats(player);
      // База 100 (50 + 5*10), модификатор -10
      expect(player.maxHp).toBe(90);
      expect(player.hp).toBe(80);
    });

    it('clamps hp when a maxHp modifier lowers the maximum', () => {
      const player = makePlayer({
        hp: 100,
        baseStats: { str: 0, dex: 0, int: 0, vit: 5 },
        statModifiers: [{ stat: 'maxHp', value: -30, op: 'add', source: 'mod' }],
      });
      recalculateActorStats(player);
      expect(player.maxHp).toBe(70);
      expect(player.hp).toBe(70);
    });

    it('restores maxHp after the modifier source is removed', () => {
      const player = makePlayer({
        baseStats: { str: 0, dex: 0, int: 0, vit: 5 },
        statModifiers: [{ stat: 'maxHp', value: 20, op: 'add', source: 'item_1' }],
      });
      recalculateActorStats(player);
      expect(player.maxHp).toBe(120);
      removeModifiersBySource(player, 'item_1');
      recalculateActorStats(player);
      expect(player.maxHp).toBe(100);
    });

    it('includes armor modifiers in derived cache', () => {
      const player = makePlayer({
        equippedArmorId: 'test_armor',
        statModifiers: [{ stat: 'armor', value: 2, op: 'add', source: 'mod' }],
      });
      recalculateActorStats(player);
      // База 4 (test_armor), модификатор +2
      expect(player.armor).toBe(6);
    });

    it('includes damage modifiers in derived cache', () => {
      const player = makePlayer({
        equippedWeaponId: 'test_sword',
        statModifiers: [{ stat: 'damage', value: -2, op: 'add', source: 'mod' }],
      });
      recalculateActorStats(player);
      // База {5,5} (test_sword), модификатор -2
      expect(player.damage).toEqual({ min: 3, max: 3 });
    });
  });

  describe('auto-recalculate on modifier changes', () => {
    it('addModifier requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 0 } });
      addModifier(player, { stat: 'vit', value: 10, op: 'add', source: 'buff' });
      recalculateActorStats(player);
      // effective vit = 10 -> maxHp = 50 + 10*10
      expect(player.maxHp).toBe(150);
    });

    it('removeModifiersBySource requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 0 } });
      addModifier(player, { stat: 'vit', value: 10, op: 'add', source: 'buff' });
      recalculateActorStats(player);
      expect(player.maxHp).toBe(150);
      removeModifiersBySource(player, 'buff');
      recalculateActorStats(player);
      expect(player.maxHp).toBe(50);
    });

    it('consumeCharge removes modifier and requires explicit recalculate', () => {
      const player = makePlayer({ baseStats: { str: 0, dex: 0, int: 0, vit: 0 } });
      addModifier(player, { stat: 'vit', value: 10, op: 'add', source: 'temp', charges: 1 });
      recalculateActorStats(player);
      expect(player.maxHp).toBe(150);
      consumeCharge(player, 'vit');
      recalculateActorStats(player);
      expect(player.maxHp).toBe(50);
    });
  });
});
