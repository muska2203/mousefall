import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameSimulation, defaultActionHandlerRegistry } from '../../src/simulation/simulation';
import { makeTestMap, makePlayer, makeEnemy } from '../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import type { GameState, EntityId, ItemEntity } from '../../src/simulation/types';
import type { EntityTemplate, ItemTemplate } from '../../src/content/schemas';
import { createRNG } from '../../src/utils/rng';
import type { ExecutionNode } from '../../src/simulation/core-types';

function makeEntityTemplate(partial: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    id: 'test_enemy',
    name: 'Тестовый враг',
    health: { max: 1 },
    combat: { damage: 1, armor: 0 },
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    equipment: {},
    abilities: [],
    lootTable: [],
    lootDropTable: [{ count: 1, weight: 1 }],
    xpReward: 0,
    renderScale: 1,
    aiSightRadius: 6,
    aiStrategyId: 'hunter',
    ...partial,
  };
}

function makeItemTemplate(partial: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: 'test_potion',
    name: 'Тестовое зелье',
    description: 'Для тестов',
    type: 'consumable',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    equipModifiers: [],
    abilityPool: [],
    grantedAbilities: [],
    ...partial,
  };
}

function makeLootGameState(): GameState {
  const map = makeTestMap(5, 5);
  const boolGrid = (w: number, h: number, v: boolean) =>
    Array.from({ length: h }, () => Array(w).fill(v) as boolean[]);

  const player = makePlayer({
    x: 1,
    y: 1,
    baseStats: { str: 998, dex: 0, int: 0, vit: 0 },
    maxAp: 2,
    ap: 2,
  });

  const enemy = makeEnemy({
    id: 'test_enemy_1',
    x: 1,
    y: 2,
    hp: 1,
    maxHp: 1,
    templateId: 'test_enemy',
    aiStrategyId: 'stub_right',
  });

  return {
    map,
    mapParams: {
      id: 'test',
      width: 5,
      height: 5,
      minRooms: 1,
      maxRooms: 1,
      minRoomSize: 3,
      maxRoomSize: 3,
      enemyDensity: 0,
      itemDensity: 0,
      enemyPool: [],
      itemPool: [],
    },
    player,
    entities: new Map<EntityId, any>([
      [player.id, player],
      [enemy.id, enemy],
    ]),
    visible: boolGrid(map.width, map.height, false),
    explored: boolGrid(map.width, map.height, false),
    turn: { activeSide: 'PLAYER', round: 1 },
    phase: 'playing',
    floor: 1,
    floorSnapshots: [],
    rng: createRNG(12345),
    nextEntityCounter: 0,
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
  };
}

function findNodeByEventType(root: ExecutionNode, eventType: string): ExecutionNode | null {
  if (root.event.type === eventType) return root;
  for (const child of root.children) {
    const found = findNodeByEventType(child, eventType);
    if (found) return found;
  }
  return null;
}

describe('Интеграция: цикл выпадения лута', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map([
        ['test_enemy', makeEntityTemplate({
          id: 'test_enemy',
          lootTable: [{ templateId: 'test_potion', weight: 1 }],
          lootDropTable: [{ count: 1, weight: 1 }],
        })],
      ]),
      players: new Map(),
      items: new Map([
        ['test_potion', makeItemTemplate({ id: 'test_potion' })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('атака убивает врага и порождает ITEM_DROPPED в дереве событий', () => {
    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    expect(result.success).toBe(true);
    expect(result.stateChanged).toBe(true);

    const playerPhase = result.phases.find(p => p.side === 'PLAYER');
    expect(playerPhase).toBeDefined();
    expect(playerPhase!.actions.length).toBe(1);

    const root = playerPhase!.actions[0];
    expect(root).toBeDefined();
    const itemDroppedNode = findNodeByEventType(root!, 'ITEM_DROPPED');
    expect(itemDroppedNode).not.toBeNull();
  });

  it('дерево событий содержит правильную цепочку ACTION_APPLIED → ENTITY_DAMAGED → ENTITY_DIED → ITEM_DROPPED', () => {
    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    const phase = result.phases[0];
    expect(phase).toBeDefined();
    const root = phase!.actions[0];
    expect(root).toBeDefined();

    expect(root!.event.type).toBe('ACTION_APPLIED');

    const damagedNode = findNodeByEventType(root!, 'ENTITY_DAMAGED');
    expect(damagedNode).not.toBeNull();
    expect(damagedNode!.parent!.event.type).toBe('ACTION_APPLIED');

    const diedNode = findNodeByEventType(root!, 'ENTITY_DIED');
    expect(diedNode).not.toBeNull();
    expect(diedNode!.parent!.event.type).toBe('ENTITY_DAMAGED');

    const droppedNode = findNodeByEventType(root!, 'ITEM_DROPPED');
    expect(droppedNode).not.toBeNull();
    expect(droppedNode!.parent!.event.type).toBe('ENTITY_DIED');
  });

  it('ItemEntity появляется в state.entities после хода', () => {
    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    const items = Array.from(simulation.getState().entities.values())
      .filter(e => e.type === 'item') as ItemEntity[];

    expect(items.length).toBe(1);
    expect(items[0]!).toBeDefined();
    expect(items[0]!.templateId).toBe('test_potion');
  });

  it('враг помечен isAlive=false, но ещё в entities до конца хода', () => {
    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    const enemy = simulation.getState().entities.get('test_enemy_1');
    expect(enemy).toBeDefined();
    expect((enemy as any).isAlive).toBe(false);
  });

  it('после beginNextPlayerTurn мёртвый враг удалён, а предмет остаётся', () => {
    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    expect(simulation.getState().entities.has('test_enemy_1')).toBe(true);

    simulation.dispatch({
      type: 'WAIT',
      entityId: 'player',
    });

    const currentState = simulation.getState();
    expect(currentState.entities.has('test_enemy_1')).toBe(false);

    const items = Array.from(currentState.entities.values())
      .filter(e => e.type === 'item') as ItemEntity[];

    expect(items.length).toBe(1);
    expect(items[0]!).toBeDefined();
    expect(items[0]!.templateId).toBe('test_potion');
  });

  it('несколько предметов из одного дропа разбрасываются по соседним клеткам', () => {
    resetRegistry();
    initRegistry({
      entities: new Map([
        ['test_enemy', makeEntityTemplate({
          id: 'test_enemy',
          lootTable: [{ templateId: 'test_potion', weight: 1 }],
          lootDropTable: [{ count: 2, weight: 1 }],
        })],
      ]),
      players: new Map(),
      items: new Map([
        ['test_potion', makeItemTemplate({ id: 'test_potion' })],
      ]),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });

    const state = makeLootGameState();
    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    simulation.dispatch({
      type: 'ATTACK',
      entityId: 'player',
      dx: 0,
      dy: 1,
    });

    const items = Array.from(simulation.getState().entities.values())
      .filter(e => e.type === 'item') as ItemEntity[];

    expect(items.length).toBe(2);

    const positions = items.map(i => ({ x: i.x, y: i.y }));
    // Оба предмета должны быть на разных клетках
    const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
    expect(uniquePositions.size).toBe(2);

    resetRegistry();
  });

  it('игрок поднимает предмет с пола по нажатию PICKUP', () => {
    const state = makeLootGameState();
    // Добавим предмет прямо под игроком
    const item: ItemEntity = {
      id: 'floor_potion',
      type: 'item',
      templateId: 'test_potion',
      x: 1,
      y: 1,
      blocksMovement: false,
      displayName: 'Тестовое зелье',
      item: {
        instanceId: 'floor_potion',
        templateId: 'test_potion',
        quantity: 1,
        grantedAbilities: [],
      },
    };
    state.entities.set(item.id, item);

    const simulation = new GameSimulation(state, defaultActionHandlerRegistry());

    simulation.dispatch({
      type: 'PICKUP',
      entityId: 'player',
    });

    const currentState = simulation.getState();
    expect(currentState.entities.has('floor_potion')).toBe(false);
    expect(currentState.player.inventory.length).toBe(1);
    expect(currentState.player.inventory[0]).toMatchObject({
      templateId: 'test_potion',
      quantity: 1,
      grantedAbilities: [],
    });
  });
});
