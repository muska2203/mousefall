import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {createDebugAddItemActionHandler, DebugContext} from '../../../../src/simulation/systems/actions/debug-add-item-action';
import {makeGameState, makePlayer} from '../../../fixtures/gameState';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

function makeBuilder() {
  return new ExecutionBuilder({type: 'ACTION_APPLIED', action: {type: 'END_TURN', entityId: 'player'}});
}

function makeContext(enabled: boolean): DebugContext {
  return {enabled};
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['health_potion', {
        id: 'health_potion',
        type: 'consumable',
        stackable: false,
        maxStack: 1,
        value: 0,
        abilityPool: [],
        grantedAbilities: [],
      } as any],
    ]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});
});

afterEach(() => {
  resetRegistry();
});

describe('createDebugAddItemActionHandler', () => {
  it('добавляет предмет в инвентарь игрока при включённом debug', () => {
    const state = makeGameState();
    const handler = createDebugAddItemActionHandler(makeContext(true));
    const action = {type: 'DEBUG_ADD_ITEM' as const, entityId: 'player', templateId: 'health_potion'};
    const builder = makeBuilder();

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(true);

    handler.execute(state, action, [], builder, builder.root);

    expect(state.player.inventory.length).toBe(1);
    expect(state.player.inventory[0]?.templateId).toBe('health_potion');
    expect(state.runStats.itemsPickedUp).toBe(0);
  });

  it('отклоняет действие при выключенном debug', () => {
    const state = makeGameState();
    const handler = createDebugAddItemActionHandler(makeContext(false));
    const action = {type: 'DEBUG_ADD_ITEM' as const, entityId: 'player', templateId: 'health_potion'};

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('debug_disabled');
  });

  it('отклоняет действие для несуществующего шаблона предмета', () => {
    const state = makeGameState();
    const handler = createDebugAddItemActionHandler(makeContext(true));
    const action = {type: 'DEBUG_ADD_ITEM' as const, entityId: 'player', templateId: 'missing_item'};

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('item_template_not_found');
  });

  it('отклоняет действие, если актор не игрок', () => {
    const state = makeGameState();
    const handler = createDebugAddItemActionHandler(makeContext(true));
    const action = {type: 'DEBUG_ADD_ITEM' as const, entityId: 'enemy_test_1', templateId: 'health_potion'};

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('only_player_can_cheat');
  });

  it('resolve возвращает пустой массив интентов', () => {
    const state = makeGameState();
    const handler = createDebugAddItemActionHandler(makeContext(true));
    const action = {type: 'DEBUG_ADD_ITEM' as const, entityId: 'player', templateId: 'health_potion'};

    expect(handler.resolve(state, action)).toEqual([]);
  });
});
