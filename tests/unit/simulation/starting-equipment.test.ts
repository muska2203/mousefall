import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeGameState} from '../../fixtures/gameState';
import {createStartingEquipment} from '../../../src/simulation/systems/starting-equipment';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {ItemTemplate} from '../../../src/content/schemas';

function mockWeapon(id: string): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
  };
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['test_staff', mockWeapon('test_staff')],
      ['unarmed', mockWeapon('unarmed')],
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

describe('createStartingEquipment', () => {
  it('без оружия в стартовом наборе экипирует unarmed', () => {
    const state = makeGameState();

    createStartingEquipment(state, state.player, []);

    expect(state.player.equippedWeaponId).toBe('unarmed');
    expect(state.player.equippedWeaponInstanceId).not.toBeNull();
    const unarmedItem = state.player.inventory.find(i => i.instanceId === state.player.equippedWeaponInstanceId);
    expect(unarmedItem?.templateId).toBe('unarmed');
  });

  it('со стартовым оружием unarmed не добавляется', () => {
    const state = makeGameState();

    createStartingEquipment(state, state.player, ['test_staff']);

    expect(state.player.equippedWeaponId).toBe('test_staff');
    expect(state.player.inventory.some(i => i.templateId === 'unarmed')).toBe(false);
  });
});
