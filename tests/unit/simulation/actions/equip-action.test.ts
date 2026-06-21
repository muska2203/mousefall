import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { equipEntity } from '../../../../src/simulation/systems/actions/equip-action';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function mockItem(id: string, type: ItemTemplate['type'], abilityPool: ItemTemplate['abilityPool'] = []): ItemTemplate {
  return {
    id,
    type,
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool,
    equipModifiers: [],
    grantedAbilities: [],
    apCost: 1,
  };
}

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'WAIT', entityId: 'any' } });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['test_staff', mockItem('test_staff', 'weapon', [{ abilityId: 'fireball', weight: 1 }])],
      ['test_armor', mockItem('test_armor', 'armor')],
      ['test_amulet', mockItem('test_amulet', 'amulet')],
      ['test_potion', mockItem('test_potion', 'consumable')],
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

describe('equipEntity.validate', () => {
  it('успех, если предмет в инвентаре и слот свободен', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []}],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'staff_1' };
    const result = equipEntity.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('ошибка, если предмета нет в инвентаре', () => {
    const state = makeGameState();
    const player = makePlayer({ inventory: [] });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'missing' };
    const result = equipEntity.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('item_not_found');
    }
  });

  it('ошибка, если тип предмета нельзя экипировать', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'test_potion', quantity: 1, grantedAbilities: []}],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const result = equipEntity.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('not_equippable');
    }
  });

  it('успех, если слот уже занят (замена предмета)', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []},
        { instanceId: 'staff_2', templateId: 'test_staff', quantity: 1, grantedAbilities: []},
      ],
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'staff_2' };
    const result = equipEntity.validate(state, action);
    expect(result.ok).toBe(true);
  });
});

describe('equipEntity.resolve', () => {
  it('возвращает EQUIP_ITEM + GRANT_ABILITY, если у предмета есть скилл', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }]},
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'staff_1' };
    const intents = equipEntity.resolve(state, action);

    expect(intents).toHaveLength(2);
    expect(intents[0]!.type).toBe('EQUIP_ITEM');
    expect(intents[1]!.type).toBe('GRANT_ABILITY');
    if (intents[1]!.type === 'GRANT_ABILITY') {
      expect(intents[1]!.ability.templateId).toBe('fireball');
      expect(intents[1]!.ability.source).toBe('equipment');
      expect(intents[1]!.ability.sourceItemInstanceId).toBe('staff_1');
    }
  });

  it('возвращает только EQUIP_ITEM, если у предмета нет скилла', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [
        { instanceId: 'armor_1', templateId: 'test_armor', quantity: 1, grantedAbilities: []},
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'armor_1' };
    const intents = equipEntity.resolve(state, action);

    expect(intents).toHaveLength(1);
    expect(intents[0]!.type).toBe('EQUIP_ITEM');
  });

  it('возвращает UNEQUIP_ITEM + REVOKE_ABILITY + EQUIP_ITEM при замене в занятом слоте', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: []},
        { instanceId: 'staff_2', templateId: 'test_staff', quantity: 1, grantedAbilities: []},
      ],
      equippedWeaponId: 'test_staff',
      equippedWeaponInstanceId: 'staff_1',
      abilities: [
        { templateId: 'fireball', source: 'equipment', sourceItemInstanceId: 'staff_1', level: 1, currentCooldown: 0 },
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'staff_2' };
    const intents = equipEntity.resolve(state, action);

    expect(intents).toHaveLength(3);
    expect(intents[0]!.type).toBe('UNEQUIP_ITEM');
    expect(intents[1]!.type).toBe('REVOKE_ABILITY');
    if (intents[1]!.type === 'REVOKE_ABILITY') {
      expect(intents[1]!.sourceItemInstanceId).toBe('staff_1');
    }
    expect(intents[2]!.type).toBe('EQUIP_ITEM');
  });
});

describe('equipEntity.execute', () => {
  it('применяет интенты и обновляет состояние', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [
        { instanceId: 'staff_1', templateId: 'test_staff', quantity: 1, grantedAbilities: [{ templateId: 'fireball', level: 1 }]},
      ],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: 'staff_1' };
    const intents = equipEntity.resolve(state, action);
    const builder = makeBuilder();
    equipEntity.execute(state, action, intents, builder, builder.root);

    expect(player.equippedWeaponId).toBe('test_staff');
    expect(player.equippedWeaponInstanceId).toBe('staff_1');
    expect(player.abilities).toHaveLength(1);
    expect(player.abilities[0]!.templateId).toBe('fireball');
  });
});
