import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTestTerrains, makePlayer} from '../../fixtures/gameState';
import {applyCharacterConfig, type CharacterConfig} from '../../../src/simulation/characterCreation';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {AbilityTemplate, PlayerTemplate} from '../../../src/content/schemas';

function mockPlayerTemplate(id: string, innateAbilities: string[] = []): PlayerTemplate {
  return {
    id,
    portraitImg: '',
    maxAp: 2,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    isDefault: false,
    innateAbilities,
    starterRelicPool: [],
  };
}

function mockSearchAbility(id: string): AbilityTemplate {
  return {
    id,
    kind: 'search',
    radius: 3,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    tags: ['delivery.ability'],
  } as AbilityTemplate;
}

function makeConfig(templateId: string): CharacterConfig {
  return {
    templateId,
    attributes: { strength: 0, agility: 0, vitality: 0, intelligence: 0, luck: 0 },
    startingEquipment: [],
  };
}

describe('applyCharacterConfig: врождённые способности (innateAbilities)', () => {
  beforeEach(() => {
    resetRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  function initWithPlayers(players: Map<string, PlayerTemplate>): void {
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players,
      items: new Map(),
      abilities: new Map([
        ['search', mockSearchAbility('search')],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  }

  it('выдаёт врождённые способности шаблона игрока при создании персонажа', () => {
    initWithPlayers(new Map([
      ['test_hero', mockPlayerTemplate('test_hero', ['search'])],
    ]));
    const player = makePlayer({ templateId: 'test_hero' });

    applyCharacterConfig(player, makeConfig('test_hero'));

    expect(player.abilities).toHaveLength(1);
    expect(player.abilities[0]).toMatchObject({
      templateId: 'search',
      source: 'innate',
      level: 1,
      currentCooldown: 0,
    });
    // Врождённая способность не привязана к экземпляру предмета.
    expect(player.abilities[0]!.sourceItemInstanceId).toBeUndefined();
  });

  it('шаблон без врождённых способностей оставляет список пустым', () => {
    initWithPlayers(new Map([
      ['test_hero', mockPlayerTemplate('test_hero')],
    ]));
    const player = makePlayer({ templateId: 'test_hero' });

    applyCharacterConfig(player, makeConfig('test_hero'));

    expect(player.abilities).toHaveLength(0);
  });

  it('повторное применение конфига не дублирует врождённые способности', () => {
    initWithPlayers(new Map([
      ['test_hero', mockPlayerTemplate('test_hero', ['search'])],
    ]));
    const player = makePlayer({ templateId: 'test_hero' });

    applyCharacterConfig(player, makeConfig('test_hero'));
    applyCharacterConfig(player, makeConfig('test_hero'));

    expect(player.abilities).toHaveLength(1);
  });
});
