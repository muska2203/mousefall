import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { unequipEntity } from '../../../../src/simulation/systems/actions/unequip-action';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function mockItem(id: string, type: ItemTemplate['type']): ItemTemplate {
  return {
    id,
    type,
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers: [],
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
      ['test_staff', mockItem('test_staff', 'weapon')],
      ['test_armor', mockItem('test_armor', 'armor')],
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

describe('unequipEntity.validate', () => {
  it('успех, если слот занят', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const result = unequipEntity.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('ошибка, если слот пуст', () => {
    const state = makeGameState();
    const player = makePlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const result = unequipEntity.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('slot_empty');
    }
  });
});

describe('unequipEntity.resolve', () => {
  it('возвращает UNEQUIP_ITEM + REVOKE_ABILITY, если у предмета есть скилл', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }]},
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const intents = unequipEntity.resolve(state, action);

    expect(intents).toHaveLength(2);
    expect(intents[0]!.type).toBe('UNEQUIP_ITEM');
    expect(intents[1]!.type).toBe('REVOKE_ABILITY');
    if (intents[1]!.type === 'REVOKE_ABILITY') {
      expect(intents[1]!.sourceItemInstanceId).toBe('staff_1');
    }
  });

  it('не порождает REVOKE_ABILITY, если у предмета нет скилла', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []},
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const intents = unequipEntity.resolve(state, action);

    expect(intents).toHaveLength(1);
    expect(intents[0]!.type).toBe('UNEQUIP_ITEM');
  });
});

describe('unequipEntity.execute', () => {
  it('снимает предмет и отзывает скилл', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }]},
      ],
      abilities: [
        { templateId: 'fireball', source: 'equipment', sourceItemInstanceId: 'staff_1', level: 1, currentCooldown: 0 },
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const intents = unequipEntity.resolve(state, action);
    const builder = makeBuilder();
    unequipEntity.execute(state, action, intents, builder, builder.root);

    expect(player.equippedWeaponId).toBeNull();
    expect(player.equippedWeaponInstanceId).toBeNull();
    expect(player.abilities).toHaveLength(0);
  });
});
