import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { ItemTemplate } from '../../../src/content/schemas';

function mockItem(id: string, overrides: Partial<ItemTemplate> & Record<string, unknown> = {}): ItemTemplate {
  return {
    id,
    type: 'consumable',
    stackable: true,
    maxStack: 10,
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
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('maps player inventory to InventoryItemViewModel', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'item_inst_1', templateId: 'health_potion', quantity: 3, grantedAbilities: []},
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
    expect(inv[0]!.detail.tags).toEqual([]);
  });

  it('uses fallback for missing item template', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'item_inst_2', templateId: 'unknown_item', quantity: 1, grantedAbilities: []},
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

describe('Inventory sorting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['sword_a', mockItem('sword_a', { name: 'Меч А', type: 'weapon', rarity: 'common' })],
        ['sword_b', mockItem('sword_b', { name: 'Меч Б', type: 'weapon', rarity: 'rare' })],
        ['armor_a', mockItem('armor_a', { name: 'Броня А', type: 'armor', rarity: 'unique' })],
        ['amulet_a', mockItem('amulet_a', { name: 'Амулет А', type: 'amulet', rarity: 'common' })],
        ['key_a', mockItem('key_a', { name: 'Ключ А', type: 'key', rarity: 'common' })],
        ['potion_a', mockItem('potion_a', { name: 'Зелье А', type: 'consumable', rarity: 'rare' })],
        ['potion_b', mockItem('potion_b', { name: 'Зелье Б', type: 'consumable', rarity: 'common' })],
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

  it('sorts by: consumable last, then slot, then rarity desc, then id', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'inst_potion_b', templateId: 'potion_b', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_key_a', templateId: 'key_a', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_amulet_a', templateId: 'amulet_a', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_potion_a', templateId: 'potion_a', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_sword_b', templateId: 'sword_b', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_armor_a', templateId: 'armor_a', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_sword_a', templateId: 'sword_a', quantity: 1, grantedAbilities: []},
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const vm = session.getViewModel();
    const inv = vm.renderInput!.inventory;
    const ids = inv.map(i => i.instanceId);

    // Ожидаемый порядок:
    // 1. Оружие (weapon): sword_b (rare) → sword_a (common)
    // 2. Броня (armor): armor_a (unique)
    // 3. Амулет (amulet): amulet_a (common)
    // 4. Ключ (key, без слота): key_a
    // 5. Расходуемые: potion_a (rare) → potion_b (common)
    expect(ids).toEqual([
      'inst_sword_b',
      'inst_sword_a',
      'inst_armor_a',
      'inst_amulet_a',
      'inst_key_a',
      'inst_potion_a',
      'inst_potion_b',
    ]);
  });

  it('sorts unknown items by id after all typed items', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'inst_z', templateId: 'unknown_z', quantity: 1, grantedAbilities: []},
        { instanceId: 'inst_a', templateId: 'unknown_a', quantity: 1, grantedAbilities: []},
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const vm = session.getViewModel();
    const inv = vm.renderInput!.inventory;
    const ids = inv.map(i => i.instanceId);

    expect(ids).toEqual(['inst_a', 'inst_z']);
  });
});
