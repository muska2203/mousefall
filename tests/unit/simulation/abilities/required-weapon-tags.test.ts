import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry';
import { useAbilityAction } from '../../../../src/simulation/systems/actions/use-ability-action';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import type { ItemTemplate, AbilityTemplate } from '../../../../src/content/schemas';
import { createTestSimulation } from '../../../helpers/simulation';

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

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'cleave',
    cooldown: 0,
    apCost: 1,
    requiredWeaponTags: [],
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    ...overrides,
  } as AbilityTemplate;
}

/** Параметры self-buff вида для тестовых способностей (исполнитель собирается фабрикой). */
const TEST_SELF_BUFF = { kind: 'selfBuff', statusType: 'test_buff', duration: 1 } as const;

describe('requiredWeaponTags', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['test_sword', mockWeapon('test_sword', {
          weapon: {
            damage: { min: 5, max: 5 },
            range: 1,
            damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
            tags: ['attack.melee', 'target.single', 'delivery.weapon'],
          },
        })],
        ['test_bow', mockWeapon('test_bow', {
          weapon: {
            damage: { min: 5, max: 5 },
            range: 2,
            damageDistribution: [{ damageTag: 'damage.physical.piercing', weight: 1.0 }],
            tags: ['attack.ranged', 'target.single', 'delivery.weapon'],
          },
        })],
      ]),
      abilities: new Map([
        ['cleave', mockAbility('cleave', {
          requiredWeaponTags: ['attack.melee'],
          tags: ['attack.melee', 'target.aoe', 'delivery.weapon'],
        })],
        ['test_always', mockAbility('test_always', {
          ...TEST_SELF_BUFF,
          requiredWeaponTags: [],
          tags: ['attack.melee', 'target.single', 'delivery.weapon'],
        })],
        ['test_melee', mockAbility('test_melee', {
          ...TEST_SELF_BUFF,
          requiredWeaponTags: ['attack.melee'],
          tags: ['attack.melee', 'target.single', 'delivery.weapon'],
        })],
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

  it('resolve не проверяет требования к оружию (гейтинг только в validate)', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_bow',
      abilities: [{ templateId: 'test_melee', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: player.id, abilityId: 'test_melee', targets: [{ x: 6, y: 5 }] };
    expect(useAbilityAction.resolve(state, action)).toEqual([{
      type: 'APPLY_STATUS',
      entityId: player.id,
      sourceEntityId: player.id,
      status: { type: 'test_buff', duration: 1, value: 0, statModifiers: null },
    }]);
  });

  it('Simulation.getAbilityIntents возвращает пустой список при несоответствии требованиям к оружию', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_bow',
      abilities: [{ templateId: 'test_melee', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = createTestSimulation(state);
    const intents = sim.getAbilityIntents('test_melee', player.id, [{ x: 6, y: 5 }]);
    expect(intents).toEqual([]);
  });

  it('Simulation.getAbilityIntents возвращает интенты при соответствии требованиям к оружию', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_sword',
      abilities: [{ templateId: 'test_melee', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = createTestSimulation(state);
    const intents = sim.getAbilityIntents('test_melee', player.id, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.type).toBe('APPLY_STATUS');
  });

  it('скилл с requiredWeaponTags: ["attack.melee"] доступен с мечом', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_sword',
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: player.id, abilityId: 'cleave', targets: [{ x: 6, y: 5 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('скилл с requiredWeaponTags: ["attack.melee"] недоступен с луком', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_bow',
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: player.id, abilityId: 'cleave', targets: [{ x: 6, y: 5 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('weapon_tags_mismatch');
    }
  });

  it('скилл без requiredWeaponTags доступен всегда', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      equippedWeaponId: 'test_bow',
      abilities: [{ templateId: 'test_always', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: player.id, abilityId: 'test_always', targets: [{ x: 5, y: 5 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(true);
  });
});
