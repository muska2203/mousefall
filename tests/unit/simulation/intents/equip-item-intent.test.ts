import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeEquipItemIntent } from '../../../../src/simulation/systems/intents/equip-item-intent-executor';
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
      ['test_amulet', mockItem('test_amulet', 'amulet')],
    ]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
  });
});

afterEach(() => {
  resetRegistry();
});

describe('executeEquipItemIntent', () => {
  it('обновляет equippedWeaponId и equippedWeaponInstanceId для слота weapon', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []}],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'staff_1', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(player.equippedWeaponId).toBe('test_staff');
    expect(player.equippedWeaponInstanceId).toBe('staff_1');
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ITEM_EQUIPPED');
    expect(node!.event).toMatchObject({
      entityId: 'player',
      itemInstanceId: 'staff_1',
      slot: 'weapon',
    });
  });

  it('обновляет equippedArmorId и equippedArmorInstanceId для слота armor', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'armor_1', templateId: 'test_armor', quantity: 1, grantedAbilities: []}],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'armor_1', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.equippedArmorId).toBe('test_armor');
    expect(player.equippedArmorInstanceId).toBe('armor_1');
  });

  it('обновляет equippedAmuletId и equippedAmuletInstanceId для слота amulet', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'amulet_1', templateId: 'test_amulet', quantity: 1, grantedAbilities: []}],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'amulet_1', slot: 'amulet' },
      builder,
      builder.root,
    );

    expect(player.equippedAmuletId).toBe('test_amulet');
    expect(player.equippedAmuletInstanceId).toBe('amulet_1');
  });

  it('возвращает null, если предмета нет в инвентаре', () => {
    const player = makePlayer({ inventory: [] });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'missing', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(player.equippedWeaponId).toBeNull();
  });

  it('применяет equipModifiers и пересчитывает статы', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []}],
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'staff_1', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(player.statModifiers.some(m => m.source === 'item_staff_1')).toBe(true);
    expect(player.damage).toBeGreaterThan(0);
  });

  it('возвращает null, если сущность не является игроком', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'nonexistent', itemInstanceId: 'staff_1', slot: 'weapon' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
