/**
 * Тесты для Simulation.getPlayerStats()
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {ItemTemplate, PlayerTemplate, DoorTemplate} from '../../../src/content/schemas';

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

function mockPlayerTemplate(id: string, template: Partial<PlayerTemplate> = {}): PlayerTemplate {
  return {
    id,
    portraitImg: `/assets/portraits/${id}-ready.png`,
    renderScale: 1.5,
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
          weapon: {baseDamage: 5, damageFormulaId: 'sword', range: 1, damageType: 'slashing'},
        })],
        ['test_armor', mockItem('test_armor', {
          type: 'armor',
          armor: {baseArmor: 4},
        })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate],
      ]),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('previewCharacterStats counts damage with starting equipment', () => {
    const stats = GameSimulation.previewCharacterStats({
      templateId: 'warrior',
      attributes: {strength: 2, agility: 3, vitality: 1, intelligence: 1, luck: 0},
      startingEquipment: ['test_sword', 'test_armor'],
    });

    // Урон меча: baseDamage 5 + str*0.8 + dex*0.5 = 5 + 1.6 + 1.5 = 8.1 → 8
    expect(stats.damage).toBe(8);
    expect(stats.armor).toBe(4);
    expect(stats.baseStats).toEqual({str: 2, dex: 3, int: 1, vit: 1});
  });

  it('previewCharacterStats counts unarmed damage without weapon', () => {
    const stats = GameSimulation.previewCharacterStats({
      templateId: 'warrior',
      attributes: {strength: 2, agility: 0, vitality: 0, intelligence: 0, luck: 0},
      startingEquipment: [],
    });

    // Без оружия: 1 + str*1.0 = 3
    expect(stats.damage).toBe(3);
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
        strategy: 'tree',
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
    expect(stats.baseStats).toEqual({str: 2, dex: 3, int: 1, vit: 1});
    expect(stats.effectiveStats.dex).toBe(3);
    expect(stats.damage).toBeGreaterThan(0);
    expect(stats.armor).toBe(4);
    expect(stats.dodgeChance).toBeCloseTo(0.06); // dex 3 * 0.02
    expect(stats.accuracy).toBeCloseTo(0.045); // dex 3 * 0.015
    expect(stats.critChance).toBeCloseTo(0.03); // dex 3 * 0.01
    expect(stats.critMultiplier).toBe(1.5);
    expect(stats.maxAp).toBe(sim.getState().player.maxAp);
  });
});
