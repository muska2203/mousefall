import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeGameState, makePlayer} from '../../../fixtures/gameState';
import {unequipEntity} from '../../../../src/simulation/systems/actions/unequip-action';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {ItemTemplate} from '../../../../src/content/schemas';
import {ExecutionBuilder} from '../../../../src/simulation/systems/actions/types';

function mockItem(id: string, type: ItemTemplate['type']): ItemTemplate {
  return {
    id,
    type,
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

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'END_TURN', entityId: 'any' } });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['test_staff', mockItem('test_staff', 'weapon')],
      ['test_armor', mockItem('test_armor', 'armor')],
      ['unarmed', mockItem('unarmed', 'weapon')],
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

  it('ошибка при попытке снять unarmed — оружие по умолчанию несъёмно', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'unarmed',
      equippedWeaponInstanceId: 'unarmed_1',
      inventory: [
        { instanceId: 'unarmed_1', templateId: 'unarmed', quantity: 1, grantedAbilities: [], affixes: [] },
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const result = unequipEntity.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('cannot_unequip_unarmed');
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
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }], affixes: [] },
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
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [], affixes: [] },
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
  it('снимает предмет, отзывает скилл и автоматически экипирует unarmed', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }], affixes: [] },
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

    // Скилл снятого предмета отозван
    expect(player.abilities).toHaveLength(0);

    // Слот оружия не пустует: экипирован свежий экземпляр unarmed
    expect(player.equippedWeaponId).toBe('unarmed');
    expect(player.equippedWeaponInstanceId).not.toBeNull();
    const unarmedItem = player.inventory.find(i => i.instanceId === player.equippedWeaponInstanceId);
    expect(unarmedItem?.templateId).toBe('unarmed');

    // Снятый посох остался в инвентаре
    expect(player.inventory.some(i => i.instanceId === 'staff_1')).toBe(true);
  });

  it('снятие брони не экипирует unarmed', () => {
    const state = makeGameState();
    const player = makePlayer({
      equippedArmorId: 'test_armor',
      equippedArmorInstanceId: 'armor_1',
      inventory: [
        { instanceId: 'armor_1', templateId: 'test_armor', quantity: 1, grantedAbilities: [], affixes: [] },
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'armor' as const };
    const intents = unequipEntity.resolve(state, action);
    const builder = makeBuilder();
    unequipEntity.execute(state, action, intents, builder, builder.root);

    expect(player.equippedArmorInstanceId).toBeNull();
    expect(player.equippedWeaponInstanceId).toBeNull();
    expect(player.inventory).toHaveLength(1);
  });
});
