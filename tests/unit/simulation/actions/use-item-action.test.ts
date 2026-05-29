import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { useItemAction } from '../../../../src/simulation/systems/actions/use-item-action';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function mockConsumable(
  id: string,
  effect: NonNullable<ItemTemplate['consumable']>['effect'],
  value?: number,
  duration?: number,
): ItemTemplate {
  return {
    id,
    name: id,
    description: '',
    symbol: '!',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    weight: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers: [],
    consumable: { effect, value, duration },
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
      ['heal_potion', mockConsumable('heal_potion', 'heal', 30)],
      ['buff_potion', mockConsumable('buff_potion', 'buff', 5, 3)],
      ['test_weapon', {
        id: 'test_weapon',
        name: 'test_weapon',
        description: '',
        symbol: '/',
        type: 'weapon',
        stackable: false,
        maxStack: 1,
        weight: 1,
        value: 0,
        rarity: 'common',
        abilityPool: [],
        equipModifiers: [],
      } as unknown as ItemTemplate],
    ]),
    abilities: new Map(),
    maps: new Map(),
    stairs: new Map(),
  });
});

afterEach(() => {
  resetRegistry();
});

describe('useItemAction.validate', () => {
  it('успех, если предмет — consumable в инвентаре', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('ошибка, если предмета нет в инвентаре', () => {
    const state = makeGameState();
    const player = makePlayer({ inventory: [] });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'missing' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('item_not_found');
    }
  });

  it('ошибка, если предмет не consumable', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'weapon_1', templateId: 'test_weapon', quantity: 1, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'weapon_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('not_consumable');
    }
  });
});

describe('useItemAction.resolve', () => {
  it('для heal возвращает HEAL + CONSUME_AP + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 2, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(3);
    expect(intents[0]!.type).toBe('HEAL');
    expect(intents[1]!.type).toBe('CONSUME_AP');
    expect(intents[2]!.type).toBe('REMOVE_ITEM');
  });

  it('для buff возвращает APPLY_STATUS + CONSUME_AP + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'buff_potion', quantity: 1, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(3);
    expect(intents[0]!.type).toBe('APPLY_STATUS');
    expect(intents[1]!.type).toBe('CONSUME_AP');
    expect(intents[2]!.type).toBe('REMOVE_ITEM');
  });
});

describe('useItemAction.execute', () => {
  it('восстанавливает HP и уменьшает quantity', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 50,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 2, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.hp).toBe(80);
    expect(player.inventory[0]!.quantity).toBe(1);
  });

  it('не превышает maxHp при лечении', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 90,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.hp).toBe(100);
  });

  it('удаляет предмет из инвентаря, если quantity была 1', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 50,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbility: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.inventory).toHaveLength(0);
  });
});
