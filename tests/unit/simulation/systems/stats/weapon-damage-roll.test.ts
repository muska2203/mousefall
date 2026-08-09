/**
 * Тесты ролла урона оружия в момент удара (rollWeaponDamage).
 *
 * Проверяем:
 * - результат всегда в границах эффективного рейнжа [min, max];
 * - при min === max ролл детерминирован;
 * - ловкость смещает распределение вверх (bias).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate } from '@content/schemas';
import { rollWeaponDamage } from '@simulation/systems/stats/weapon-damage-roll.ts';
import { createRNG } from '@utils/rng';
import { makeGameState, makePlayer } from '../../../../fixtures/gameState.ts';

function mockWeapon(id: string, min: number, max: number): ItemTemplate {
  return {
    id,
    type: 'weapon',
    subtype: 'sword',
    level: 1,
    stackable: false,
    maxStack: 1,
    value: 0,
    weapon: {
      damage: { min, max },
      range: 1,
      damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
      tags: [],
    },
  } as unknown as ItemTemplate;
}

function rollWithSeed(seed: number, dex: number, weaponId = 'test_sword'): number {
  const player = makePlayer({
    baseStats: { str: 0, dex, int: 0, vit: 0 },
    equippedWeaponId: weaponId,
  });
  const state = makeGameState();
  state.player = player;
  state.entities.set(player.id, player);
  state.runtimeRng = createRNG(seed);
  return rollWeaponDamage(state, player);
}

describe('rollWeaponDamage', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['test_sword', mockWeapon('test_sword', 2, 5)],
        ['test_fixed', mockWeapon('test_fixed', 3, 3)],
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

  it('результат всегда в границах рейнжа, границы достижимы', () => {
    const rolls = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const damage = rollWithSeed(seed, 0);
      expect(damage).toBeGreaterThanOrEqual(2);
      expect(damage).toBeLessThanOrEqual(5);
      rolls.add(damage);
    }
    expect(rolls.has(2)).toBe(true);
    expect(rolls.has(5)).toBe(true);
  });

  it('при min === max возвращает это значение на любом seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(rollWithSeed(seed, 10, 'test_fixed')).toBe(3);
    }
  });

  it('ловкость смещает распределение вверх', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
    const avg = (dex: number) =>
      seeds.reduce((sum, seed) => sum + rollWithSeed(seed, dex), 0) / seeds.length;

    // Среднее с dex 40 заметно выше среднего с dex 0 (u^(1/(1+dex*K)) растёт с dex).
    expect(avg(40)).toBeGreaterThan(avg(0));
  });

  it('детерминирован по seed runtimeRng', () => {
    expect(rollWithSeed(42, 5)).toBe(rollWithSeed(42, 5));
  });
});
