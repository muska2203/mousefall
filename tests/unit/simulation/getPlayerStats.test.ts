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
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    isDefault: false,
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
          weapon: {damage: { min: 5, max: 5 }, range: 1, minRange: 1, damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }], tags: []},
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
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
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

    // Урон меча берётся рейнжем из шаблона: { min: 5, max: 5 }
    expect(stats.damage).toEqual({ min: 5, max: 5 });
    expect(stats.armor).toBe(4);
    expect(stats.baseStats).toEqual({str: 2, dex: 3, int: 1, vit: 1});
  });

  it('previewCharacterStats counts unarmed damage without weapon', () => {
    const stats = GameSimulation.previewCharacterStats({
      templateId: 'warrior',
      attributes: {strength: 2, agility: 0, vitality: 0, intelligence: 0, luck: 0},
      startingEquipment: [],
    });

    // Без оружия — рейнж безоружной атаки { min: 1, max: 1 }
    expect(stats.damage).toEqual({ min: 1, max: 1 });
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
        roomTypePool: ['normal'],
        startRoomTypeId: 'start',
        bossRoomTypeId: 'boss',
        bossDoorId: 'boss_door',
        rewardRoomTypeId: 'reward',
        finalFloor: 10,
      },
    );

    const stats = sim.getPlayerStats();

    expect(stats.hp).toBeGreaterThan(0);
    expect(stats.maxHp).toBeGreaterThan(0);
    expect(stats.baseStats).toEqual({str: 2, dex: 3, int: 1, vit: 1});
    expect(stats.effectiveStats.dex).toBe(3);
    expect(stats.damage.max).toBeGreaterThan(0);
    expect(stats.armor).toBe(4);
    expect(stats.critMultiplier).toBe(1.5);
    expect(stats.maxAp).toBe(sim.getState().player.maxAp);
  });
});
