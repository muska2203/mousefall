/**
 * Тесты выдачи стартовой реликвии, выбранной на экране создания персонажа
 * (roadmap 1.1): createNewGame выдаёт реликвию из starterRelicPool шаблона
 * через интент GRANT_RELIC, чужой/невалидный ID тихо игнорируется.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import type {CharacterConfig} from '../../../src/simulation/characterCreation';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {DoorTemplate, ItemTemplate, MapParams, PlayerTemplate, RelicTemplate} from '../../../src/content/schemas';

function mockRelic(id: string, overrides: Partial<RelicTemplate> = {}): RelicTemplate {
  return {
    id,
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
    ...overrides,
  };
}

function mockPlayerTemplate(id: string, starterRelicPool: string[] = []): PlayerTemplate {
  return {
    id,
    portraitImg: '',
    maxAp: 2,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    isDefault: false,
    innateAbilities: [],
    starterRelicPool,
  };
}

const testMapParams: MapParams = {
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
} as MapParams;

function makeConfig(starterRelicId?: string): CharacterConfig {
  return {
    templateId: 'warrior',
    attributes: {strength: 0, agility: 0, vitality: 0, intelligence: 0, luck: 0},
    startingEquipment: [],
    starterRelicId,
  };
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map([
      ['warrior', mockPlayerTemplate('warrior', ['relic_a', 'relic_b'])],
    ]),
    items: new Map<string, ItemTemplate>([
      // Безоружная атака: слот оружия никогда не пустует (starting-equipment.ts).
      ['unarmed', {
        id: 'unarmed',
        type: 'weapon',
        stackable: false,
        maxStack: 1,
        value: 0,
        rarity: 'common',
        abilityPool: [],
        fixedModifiers: [],
        grantedAbilities: [],
        apCost: 1,
        weapon: {damage: {min: 1, max: 1}, range: 1, minRange: 1, damageDistribution: [{damageTag: 'damage.physical.blunt', weight: 1.0}], tags: []},
      } as ItemTemplate],
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
    relics: new Map([
      ['relic_a', mockRelic('relic_a', {statModifiers: [{stat: 'maxHp', value: 10, op: 'add'}]})],
      ['relic_b', mockRelic('relic_b')],
    ]),
  });
});

afterEach(() => {
  resetRegistry();
});

describe('createNewGame: стартовая реликвия', () => {
  it('выдаёт выбранную реликвию из starterRelicPool шаблона и применяет её модификаторы', () => {
    const sim = GameSimulation.createNewGame(12345, makeConfig('relic_a'), testMapParams);
    const player = sim.getState().player;

    expect(player.relics.map((r) => r.templateId)).toEqual(['relic_a']);
    // Модификатор реликвии (+10 maxHp) применён: базовый maxHp игрока без реликвии меньше.
    const withoutRelic = GameSimulation.createNewGame(12345, makeConfig(), testMapParams);
    expect(player.maxHp).toBe(withoutRelic.getState().player.maxHp + 10);
  });

  it('не выдаёт реликвию с ID вне starterRelicPool шаблона', () => {
    const sim = GameSimulation.createNewGame(12345, makeConfig('relic_not_in_pool'), testMapParams);

    expect(sim.getState().player.relics).toEqual([]);
  });

  it('без starterRelicId коллекция реликвий пуста', () => {
    const sim = GameSimulation.createNewGame(12345, makeConfig(), testMapParams);

    expect(sim.getState().player.relics).toEqual([]);
  });
});

describe('previewCharacterStats: стартовая реликвия', () => {
  it('учитывает постоянные модификаторы выбранной реликвии', () => {
    const withRelic = GameSimulation.previewCharacterStats(makeConfig('relic_a'));
    const withoutRelic = GameSimulation.previewCharacterStats(makeConfig());

    expect(withRelic.maxHp).toBe(withoutRelic.maxHp + 10);
  });

  it('игнорирует ID реликвии вне starterRelicPool шаблона', () => {
    const invalid = GameSimulation.previewCharacterStats(makeConfig('relic_not_in_pool'));
    const withoutRelic = GameSimulation.previewCharacterStats(makeConfig());

    expect(invalid.maxHp).toBe(withoutRelic.maxHp);
  });
});
