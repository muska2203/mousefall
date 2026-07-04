import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { DefaultActionPointCostResolver } from '../../../../src/simulation/systems/action-cost-resolver';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { MAX_ABILITY_ALL_AP_COST } from '../../../../src/utils/constants';
import type { AbilityTemplate, ItemTemplate } from '../../../../src/content/schemas';

describe('DefaultActionPointCostResolver', () => {
  const resolver = new DefaultActionPointCostResolver();

  function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
    return {
      id,
      cooldown: 0,
      apCost: 1,
      ...overrides,
    } as AbilityTemplate;
  }

  function mockItem(id: string, overrides: Partial<ItemTemplate> = {}): ItemTemplate {
    return {
      id,
      type: 'consumable',
      stackable: false,
      maxStack: 1,
      value: 0,
      apCost: 1,
      ...overrides,
    } as ItemTemplate;
  }

  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['health_potion', mockItem('health_potion', { apCost: 1 })],
        ['expensive_potion', mockItem('expensive_potion', { apCost: 3 })],
      ]),
      abilities: new Map([
        ['magic_slap', mockAbility('magic_slap', { apCost: 1 })],
        ['fireball', mockAbility('fireball', { apCost: 2 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('MOVE и INTERACT стоят 1 AP', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 }, state)).toBe(1);
    expect(resolver.getCost({ type: 'INTERACT', entityId: 'player', targetId: 'door_1' }, state)).toBe(1);
  });

  it('ATTACK стоит 1 AP', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 }, state)).toBe(1);
  });

  it('EQUIP и UNEQUIP стоят 1 AP', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'EQUIP', entityId: 'player', itemInstanceId: 'w1' }, state)).toBe(1);
    expect(resolver.getCost({ type: 'UNEQUIP', entityId: 'player', slot: 'weapon' }, state)).toBe(1);
  });

  it('WAIT стоит текущее количество AP актора', () => {
    const player = makePlayer({ maxAp: 3, ap: 3 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    expect(resolver.getCost({ type: 'WAIT', entityId: 'player' }, state)).toBe(3);

    player.ap = 1;
    expect(resolver.getCost({ type: 'WAIT', entityId: 'player' }, state)).toBe(1);
  });

  it('USE_ABILITY берёт apCost из шаблона', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'magic_slap', targets: [] }, state)).toBe(1);
    expect(resolver.getCost({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [] }, state)).toBe(2);
  });

  it('USE_ABILITY с apCost "all" тратит текущие AP актора, но не более MAX_ABILITY_ALL_AP_COST', () => {
    resetRegistry();
    const player = makePlayer({ maxAp: 5, ap: 3 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['parry', mockAbility('parry', { apCost: 'all' })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
    expect(resolver.getCost({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'parry', targets: [] }, state)).toBe(3);

    player.ap = 5;
    expect(resolver.getCost({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'parry', targets: [] }, state)).toBe(MAX_ABILITY_ALL_AP_COST);
  });

  it('USE_ABILITY возвращает fallback 1 для неизвестной способности', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'unknown', targets: [] }, state)).toBe(1);
  });

  it('USE_ITEM берёт apCost из шаблона предмета в инвентаре', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'p1', templateId: 'health_potion', quantity: 1, grantedAbilities: [] },
        { instanceId: 'p2', templateId: 'expensive_potion', quantity: 1, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    expect(resolver.getCost({ type: 'USE_ITEM', entityId: 'player', itemInstanceId: 'p1' }, state)).toBe(1);
    expect(resolver.getCost({ type: 'USE_ITEM', entityId: 'player', itemInstanceId: 'p2' }, state)).toBe(3);
  });

  it('USE_ITEM возвращает fallback 1 для отсутствующего предмета', () => {
    const state = makeGameState();
    expect(resolver.getCost({ type: 'USE_ITEM', entityId: 'player', itemInstanceId: 'missing' }, state)).toBe(1);
  });

  it('бросает ошибку для неизвестного типа действия', () => {
    const state = makeGameState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolver.getCost({ type: 'UNKNOWN' as any, entityId: 'player' }, state)).toThrow();
  });
});
