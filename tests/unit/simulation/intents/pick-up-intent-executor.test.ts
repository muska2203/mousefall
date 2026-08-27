/**
 * Тесты исполнителя интента PICK_UP.
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import {executeIntent} from '@simulation/systems/intents/execute-intent';
import {initObjectContentRegistry, makeEnemy, makeFloorItemContainer, makeGameState, makePlayer} from '../../../fixtures/gameState';
import type {Entity, EntityId, InventoryItem} from '@simulation/types';
import type {ItemTemplate} from '@content/schemas';

describe('executePickUpIntent', () => {
  it('поднимает FloorItemContainerEntity: добавляет предмет в инвентарь игрока и удаляет контейнер с пола', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const container = makeFloorItemContainer({ x: 5, y: 5, id: 'potion_container' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [container.id, container],
      ]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'INTERACT', entityId: 'player', targetId: container.id },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: 'player', itemId: container.id, templateId: container.item.templateId },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(state.entities.has(container.id)).toBe(false);
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0]).toBe(container.item);

    expect(node!.event).toEqual({
      type: 'ITEM_PICKED_UP', isFieldEvent: true,
      entityId: 'player',
      itemInstanceId: container.item.instanceId,
      templateId: container.item.templateId,
    });
  });

  it('возвращает null, если предмет отсутствует на полу', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'INTERACT', entityId: 'player', targetId: 'missing_item' },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: 'player', itemId: 'missing_item', templateId: 'health_potion' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('возвращает null, если актор не является игроком', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const container = makeFloorItemContainer({ x: 5, y: 5, id: 'potion_container' });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([
        [enemy.id, enemy],
        [container.id, container],
      ]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'INTERACT', entityId: enemy.id, targetId: container.id },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: enemy.id, itemId: container.id, templateId: container.item.templateId },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});

describe('executePickUpIntent: слияние стопок (roadmap-1-floor п. 1.4)', () => {
  const mockItem = (id: string, stackable: boolean): ItemTemplate => ({
    id,
    type: 'consumable',
    rarity: 'common',
    stackable,
    maxStack: 3,
    value: 0,
    consumable: { effect: 'heal', value: 5 },
    fixedModifiers: [],
    abilityPool: [],
    grantedAbilities: [],
    apCost: 1,
  });

  const inventoryStack = (templateId: string, quantity: number, instanceId: string): InventoryItem => ({
    instanceId,
    templateId,
    quantity,
    grantedAbilities: [],
    affixes: [],
  });

  beforeEach(() => {
    initObjectContentRegistry({
      items: new Map([
        ['health_potion', mockItem('health_potion', true)],
        ['plain_consumable', mockItem('plain_consumable', false)],
      ]),
    });
  });

  function setupPickup(inventory: InventoryItem[], templateId: string, containerQuantity: number) {
    const player = makePlayer({ x: 5, y: 5 });
    player.inventory.push(...inventory);
    const container = makeFloorItemContainer({
      x: 5,
      y: 5,
      id: 'potion_container',
      templateId,
      item: inventoryStack(templateId, containerQuantity, 'floor_item_test_1'),
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [container.id, container],
      ]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'INTERACT', entityId: 'player', targetId: container.id },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: 'player', itemId: container.id, templateId },
      builder,
      builder.root,
    );

    return { player, container, state, node };
  }

  it('сливает поднятый предмет в неполный стек того же шаблона', () => {
    const { player, container, state, node } = setupPickup([inventoryStack('health_potion', 2, 'inv_1')], 'health_potion', 1);

    expect(node).not.toBeNull();
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0]!.quantity).toBe(3);
    expect(state.entities.has(container.id)).toBe(false);
    expect(state.runStats.itemsPickedUp).toBe(1);
  });

  it('доливает стек до maxStack, остаток кладётся новой ячейкой', () => {
    const { player, state } = setupPickup([inventoryStack('health_potion', 2, 'inv_1')], 'health_potion', 3);

    expect(player.inventory).toHaveLength(2);
    expect(player.inventory[0]!.quantity).toBe(3);
    expect(player.inventory[1]!.quantity).toBe(2);
    expect(player.inventory[1]!.instanceId).toBe('floor_item_test_1');
    expect(state.runStats.itemsPickedUp).toBe(3);
  });

  it('полный стек не доливается — предмет кладётся новой ячейкой', () => {
    const { player } = setupPickup([inventoryStack('health_potion', 3, 'inv_1')], 'health_potion', 1);

    expect(player.inventory).toHaveLength(2);
    expect(player.inventory[0]!.quantity).toBe(3);
    expect(player.inventory[1]!.quantity).toBe(1);
  });

  it('доливает несколько неполных стеков по очереди', () => {
    const { player } = setupPickup(
      [inventoryStack('health_potion', 2, 'inv_1'), inventoryStack('health_potion', 2, 'inv_2')],
      'health_potion',
      2,
    );

    expect(player.inventory).toHaveLength(2);
    expect(player.inventory.map((i) => i.quantity)).toEqual([3, 3]);
  });

  it('не сливает нестакаемый предмет даже при совпадении templateId', () => {
    const { player } = setupPickup([inventoryStack('plain_consumable', 1, 'inv_1')], 'plain_consumable', 1);

    expect(player.inventory).toHaveLength(2);
    expect(player.inventory.map((i) => i.quantity)).toEqual([1, 1]);
  });
});
