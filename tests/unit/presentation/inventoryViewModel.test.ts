import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { ItemTemplate } from '../../../src/content/schemas';

function mockItem(id: string, overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id,
    name: 'Тестовый предмет',
    description: 'Описание',
    symbol: '!',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    weight: 1,
    value: 0,
    ...overrides,
  } as ItemTemplate;
}

describe('Inventory ViewModel', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['health_potion', mockItem('health_potion', { name: 'Зелье здоровья', type: 'consumable' })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('maps player inventory to InventoryItemViewModel', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'item_inst_1', templateId: 'health_potion', quantity: 3 },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const vm = session.getViewModel();
    const inv = vm.renderInput!.inventory;

    expect(inv).toHaveLength(1);
    expect(inv[0]!.instanceId).toBe('item_inst_1');
    expect(inv[0]!.templateId).toBe('health_potion');
    expect(inv[0]!.quantity).toBe(3);
    expect(inv[0]!.detail.name).toBe('Зелье здоровья');
  });

  it('uses fallback for missing item template', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'item_inst_2', templateId: 'unknown_item', quantity: 1 },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const vm = session.getViewModel();
    const inv = vm.renderInput!.inventory;

    expect(inv).toHaveLength(1);
    expect(inv[0]!.detail.name).toBe('unknown_item');
    expect(inv[0]!.detail.fallbackIcon).toBe('?');
  });
});
