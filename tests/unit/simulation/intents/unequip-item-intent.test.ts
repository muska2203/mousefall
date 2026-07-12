import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeUnequipItemIntent } from '../../../../src/simulation/systems/intents/unequip-item-intent-executor';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function mockItem(id: string, type: ItemTemplate['type'], equipModifiers: ItemTemplate['equipModifiers'] = []): ItemTemplate {
  return {
    id,
    type,
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers,
    grantedAbilities: [],
    ruleIds: [],
    apCost: 1,
  };
}

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: 'any' } });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['test_staff', mockItem('test_staff', 'weapon', [{ stat: 'str', value: 2, op: 'add' }])],
      ['test_armor', mockItem('test_armor', 'armor')],
    ]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
});
});

afterEach(() => {
  resetRegistry();
});

describe('executeUnequipItemIntent', () => {
  it('сбрасывает equippedWeaponId и equippedWeaponInstanceId', () => {
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(player.equippedWeaponId).toBeNull();
    expect(player.equippedWeaponInstanceId).toBeNull();
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ITEM_UNEQUIPPED');
  });

  it('сбрасывает equippedArmorId и equippedArmorInstanceId', () => {
    const player = makePlayer({
      equippedArmorId: 'test_armor',
      equippedArmorInstanceId: 'armor_1',
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.equippedArmorId).toBeNull();
    expect(player.equippedArmorInstanceId).toBeNull();
  });

  it('возвращает null, если слот пуст', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('возвращает null, если сущность не является игроком', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'nonexistent', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('удаляет equipModifiers и пересчитывает статы', () => {
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      statModifiers: [{ stat: 'str', value: 2, op: 'add', source: 'item_staff_1' }],
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(player.statModifiers.some(m => m.source === 'item_staff_1')).toBe(false);
  });
});
