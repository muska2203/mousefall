/**
 * Тесты для Simulation.getPlayerStats()
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {initRegistry, resetRegistry} from '../../../src/simulation/content/registry';
import type {ItemTemplate, PlayerTemplate} from '../../../src/simulation/schemas/contentSchemas';

function mockItem(id: string, template: Partial<ItemTemplate>): ItemTemplate {
  return {
    id,
    name: id,
    description: '',
    symbol: '?',
    type: 'consumable',
    stackable: false,
    maxStack: 1,
    weight: 1,
    value: 0,
    ...template,
  } as ItemTemplate;
}

function mockPlayerTemplate(id: string, template: Partial<PlayerTemplate> = {}): PlayerTemplate {
  return {
    id,
    name: id,
    description: '',
    symbol: '@',
    portraitImg: `/assets/portraits/${id}-ready.png`,
    spriteId: id,
    renderScale: 1.5,
    abilities: ['fireball', 'magic_slap'],
    ...template,
  } as PlayerTemplate;
}

describe('GameSimulation.getPlayerStats', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map([
        ['warrior', mockPlayerTemplate('warrior')],
      ]),
      items: new Map([
        ['test_sword', mockItem('test_sword', {
          type: 'weapon',
          weapon: {baseDamage: 5, damageFormulaId: 'sword', range: 1, grantedAbilities: []},
        })],
        ['test_armor', mockItem('test_armor', {
          type: 'armor',
          armor: {baseArmor: 4, grantedAbilities: []},
        })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('returns current player stats snapshot', () => {
    const sim = GameSimulation.createNewGame(
      12345,
      {
        templateId: 'warrior',
        attributes: {strength: 2, agility: 3, vitality: 1, intelligence: 1, luck: 0},
        startingEquipment: ['test_sword', 'test_armor'],
      },
      {
        id: 'floor_1',
        height: 10,
        width: 10,
        minRooms: 2,
        maxRooms: 4,
        minRoomSize: 3,
        maxRoomSize: 5,
        enemyDensity: 0,
        itemDensity: 0,
        enemyPool: [],
        itemPool: [],
      },
    );

    const stats = sim.getPlayerStats();

    expect(stats.level).toBe(1);
    expect(stats.xp).toBe(0);
    expect(stats.hp).toBeGreaterThan(0);
    expect(stats.maxHp).toBeGreaterThan(0);
    expect(stats.mp).toBeGreaterThanOrEqual(0);
    expect(stats.maxMp).toBeGreaterThanOrEqual(0);
    expect(stats.baseStats).toEqual({str: 2, dex: 3, int: 1, vit: 1});
    expect(stats.effectiveStats.dex).toBe(3);
    expect(stats.damage).toBeGreaterThan(0);
    expect(stats.armor).toBe(4);
    expect(stats.dodgeChance).toBeCloseTo(0.06); // dex 3 * 0.02
    expect(stats.accuracy).toBeCloseTo(0.045); // dex 3 * 0.015
    expect(stats.critChance).toBeCloseTo(0.03); // dex 3 * 0.01
    expect(stats.critMultiplier).toBe(1.5);
  });
});
