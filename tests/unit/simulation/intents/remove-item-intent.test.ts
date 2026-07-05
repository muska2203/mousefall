import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeRemoveItemIntent } from '../../../../src/simulation/systems/intents/remove-item-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: 'any' } });
}

describe('executeRemoveItemIntent', () => {
  it('уменьшает quantity на 1', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 3, grantedAbilities: []}],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeRemoveItemIntent(
      state,
      { type: 'REMOVE_ITEM', entityId: 'player', itemInstanceId: 'potion_1', templateId: 'heal_potion' },
      builder,
      builder.root,
    );

    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0]!.quantity).toBe(2);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ITEM_USED');
  });

  it('удаляет предмет из инвентаря, если quantity была 1', () => {
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbilities: []}],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeRemoveItemIntent(
      state,
      { type: 'REMOVE_ITEM', entityId: 'player', itemInstanceId: 'potion_1', templateId: 'heal_potion' },
      builder,
      builder.root,
    );

    expect(player.inventory).toHaveLength(0);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ITEM_USED');
  });

  it('возвращает null, если предмета нет в инвентаре', () => {
    const player = makePlayer({ inventory: [] });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeRemoveItemIntent(
      state,
      { type: 'REMOVE_ITEM', entityId: 'player', itemInstanceId: 'missing', templateId: 'heal_potion' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('возвращает null, если сущность не игрок', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeRemoveItemIntent(
      state,
      { type: 'REMOVE_ITEM', entityId: 'ghost', itemInstanceId: 'potion_1', templateId: 'heal_potion' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
