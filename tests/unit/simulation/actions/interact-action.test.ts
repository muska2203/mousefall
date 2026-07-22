/**
 * Тесты единого action взаимодействия `INTERACT`.
 *
 * Покрытие:
 * - `resolveInteraction` для дверей, лестниц и контейнеров предметов.
 * - Валидация action (`validate`): тип action, расстояние, состояние цели,
 *   границы этажей, специфичные ограничения (закрытие двери).
 * - Порождение intent'ов (`resolve`): OPEN_DOOR, CLOSE_DOOR, PICK_UP,
 *   FLOOR_TRANSITION.
 * - Полные flow через `GameSimulation.dispatch`, включая исполнение intent'ов
 *   и порождённых событий.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { interactAction } from '../../../../src/simulation/systems/actions/interact-action';
import { resolveInteraction } from '../../../../src/simulation/systems/interactions/resolve-interaction';
import { DefaultActionPointCostResolver } from '../../../../src/simulation/systems/action-cost-resolver';
import { makeGameState, makePlayer, makeEnemy, makeDoor, makeStairs, makeStateWithPlayerAndEntity, makeFloorItemContainer } from '../../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { MAX_FLOOR } from '../../../../src/utils/constants';
import type { DoorEntity, StairsEntity, Entity, EntityId } from '../../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../../src/simulation/simulation';

function mockDoorTemplate(id: string) {
  return {
    id,
    interactionKind: 'door',
    maxHp: 30,
    armor: 2,
    renderScale: 1,
  } as any;
}

function mockStairsTemplate(id: string) {
  return {
    id,
    interactionKind: 'stairs',
    renderScale: 1,
  } as any;
}

describe('resolveInteraction', () => {
  it('возвращает open_door для закрытой двери', () => {
    const door = makeDoor({ isOpen: false });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, door, player);
    expect(result).toEqual({ interactionId: 'open_door', usableFromAdjacent: true });
  });

  it('возвращает close_door для открытой двери', () => {
    const door = makeDoor({ isOpen: true, blocksMovement: false });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, door, player);
    expect(result).toEqual({ interactionId: 'close_door', usableFromAdjacent: true });
  });

  it('возвращает null для разрушенной двери', () => {
    const door = makeDoor({ isAlive: false });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, door, player);
    expect(result).toBeNull();
  });

  it('возвращает descend для лестницы вниз', () => {
    const stairs = makeStairs('stairs_down');
    const state = makeGameState({ entities: new Map([[stairs.id, stairs]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, stairs, player);
    expect(result).toEqual({ interactionId: 'descend', usableFromAdjacent: false });
  });

  it('возвращает ascend для лестницы вверх', () => {
    const stairs = makeStairs('stairs_up');
    const state = makeGameState({ entities: new Map([[stairs.id, stairs]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, stairs, player);
    expect(result).toEqual({ interactionId: 'ascend', usableFromAdjacent: false });
  });

  it('использует поле direction, а не templateId, для определения направления лестницы', () => {
    const stairs = makeStairs('ladder_up', { direction: 'up' });
    const state = makeGameState({ entities: new Map([[stairs.id, stairs]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, stairs, player);
    expect(result).toEqual({ interactionId: 'ascend', usableFromAdjacent: false });
  });

  it('возвращает pickup для контейнера предмета на полу', () => {
    const container = makeFloorItemContainer({ x: 5, y: 5 });
    const state = makeGameState({ entities: new Map([[container.id, container]]) });
    const player = makePlayer();

    const result = resolveInteraction(state, container, player);
    expect(result).toEqual({ interactionId: 'pickup', usableFromAdjacent: false });
  });

  it('возвращает null для сущности без interactionKind', () => {
    const player = makePlayer();
    const enemy = { id: 'enemy_test_1', type: 'enemy', x: 5, y: 5 } as any;
    const state = makeGameState({ entities: new Map([[enemy.id, enemy]]) });

    const result = resolveInteraction(state, enemy, player);
    expect(result).toBeNull();
  });
});

describe('interactAction.validate', () => {
  it('отклоняет действие с типом, отличным от INTERACT', () => {
    const state = makeGameState();

    const validation = interactAction.validate(state, {
      type: 'END_TURN',
      entityId: 'player',
    } as any);

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('wrong_action_type');
  });

  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([['wooden_door', mockDoorTemplate('wooden_door')]]),
      stairs: new Map([
        ['stairs_down', mockStairsTemplate('stairs_down')],
        ['stairs_up', mockStairsTemplate('stairs_up')],
      ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('принимает взаимодействие с дверью на соседней клетке', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(true);
  });

  it('отклоняет взаимодействие с дверью, если актёр не на соседней клетке', () => {
    const player = makePlayer({ x: 1, y: 1 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('target_not_adjacent');
  });

  it('отклоняет закрытие двери, если актёр стоит на её клетке', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('cannot_close_door_from_inside');
  });

  it('принимает открытие двери, если актёр стоит на её клетке', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isOpen: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(true);
  });

  it('принимает взаимодействие с лестницей, когда актёр стоит на ней', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(validation.ok).toBe(true);
  });

  it('отклоняет переход этажа, если актёр не игрок', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({ entities: new Map<EntityId, Entity>([
      [player.id, player],
      [enemy.id, enemy],
      [stairs.id, stairs],
    ]) });

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: enemy.id,
      targetId: stairs.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('only_player_can_transition');
  });

  it('отклоняет взаимодействие с лестницей, если актёр не на её клетке', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('actor_not_on_target');
  });

  it('отклоняет спуск на последнем этаже', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);
    state.floor = MAX_FLOOR;

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('max_floor_reached');
  });

  it('отклоняет подъём на первом этаже', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_up', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);
    state.floor = 1;

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('min_floor_reached');
  });

  it('отклоняет действие, если актёр не существует', () => {
    const door = makeDoor();
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: 'ghost',
      targetId: door.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('entity_not_exists');
  });

  it('отклоняет действие, если цель не существует', () => {
    const player = makePlayer();
    const state = makeStateWithPlayerAndEntity(player, makeDoor());

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: 'ghost',
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('target_not_exists');
  });

  it('отклоняет действие, если с целью нельзя взаимодействовать', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = { id: 'enemy_test_1', type: 'enemy', x: 5, y: 5 } as any;
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: enemy.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('no_interaction_available');
  });

  it('resolve возвращает пустой массив при невалидном типе действия', () => {
    const state = makeGameState();

    const intents = interactAction.resolve(state, {
      type: 'END_TURN',
      entityId: 'player',
    } as any);

    expect(intents).toEqual([]);
  });

  it('resolve возвращает пустой массив, если цель не существует', () => {
    const player = makePlayer();
    const state = makeStateWithPlayerAndEntity(player, makeDoor());

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: 'ghost',
    });

    expect(intents).toEqual([]);
  });
});

import * as resolveInteractionModule from '../../../../src/simulation/systems/interactions/resolve-interaction';

describe('unsupported interaction', () => {
  it('resolve возвращает пустой массив для неподдерживаемого interactionId', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isOpen: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const spy = vi.spyOn(resolveInteractionModule, 'resolveInteraction').mockReturnValue({
      interactionId: 'pull_lever' as any,
      usableFromAdjacent: true,
    });

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(intents).toEqual([]);
    spy.mockRestore();
  });
});

describe('interactAction.resolve', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['health_potion', { id: 'health_potion', name: 'Зелье здоровья', description: '', type: 'consumable', stackable: false, maxStack: 1, value: 0, abilityPool: [], grantedAbilities: [] } as any],
      ]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([['wooden_door', mockDoorTemplate('wooden_door')]]),
      stairs: new Map([
        ['stairs_down', mockStairsTemplate('stairs_down')],
        ['stairs_up', mockStairsTemplate('stairs_up')],
      ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('порождает OPEN_DOOR для закрытой двери', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(intents).toEqual([{
      type: 'OPEN_DOOR',
      entityId: player.id,
      targetPosition: { x: 4, y: 5 },
    }]);
  });

  it('порождает CLOSE_DOOR для открытой двери', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(intents).toEqual([{
      type: 'CLOSE_DOOR',
      entityId: player.id,
      targetPosition: { x: 4, y: 5 },
    }]);
  });

  it('порождает PICK_UP для контейнера предмета', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const container = makeFloorItemContainer({
      x: 5,
      y: 5,
      id: 'container_1',
      item: {
        instanceId: 'item_instance_1',
        templateId: 'health_potion',
        quantity: 1,
        grantedAbilities: [],
      },
    });
    const state = makeStateWithPlayerAndEntity(player, container);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: container.id,
    });

    expect(intents).toEqual([{
      type: 'PICK_UP',
      entityId: player.id,
      itemId: container.id,
      templateId: 'health_potion',
    }]);
  });

  it('порождает FLOOR_TRANSITION со спуском для лестницы вниз', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(intents).toEqual([{
      type: 'FLOOR_TRANSITION',
      entityId: player.id,
      direction: 'down',
    }]);
  });

  it('порождает FLOOR_TRANSITION с подъёмом для лестницы вверх', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_up', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);
    state.floor = 2;

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(intents).toEqual([{
      type: 'FLOOR_TRANSITION',
      entityId: player.id,
      direction: 'up',
    }]);
  });
});

describe('interactAction.validate — дополнительные проверки', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([['wooden_door', mockDoorTemplate('wooden_door')]]),
      stairs: new Map([
        ['stairs_down', mockStairsTemplate('stairs_down')],
        ['stairs_up', mockStairsTemplate('stairs_up')],
      ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('отклоняет взаимодействие с разрушенной дверью', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isAlive: false, hp: 0 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('no_interaction_available');
  });

  it('отклоняет закрытие двери, если клетка занята другой сущностью', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const enemy = { id: 'enemy_test_1', type: 'enemy', x: 4, y: 5, blocksMovement: true } as any;
    const state = makeGameState({
      player,
      entities: new Map([
        [player.id, player],
        [door.id, door],
        [enemy.id, enemy],
      ]),
    });

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('door_tile_blocked');
  });
});

describe('INTERACT — полные flow', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['health_potion', { id: 'health_potion', name: 'Зелье здоровья', description: '', type: 'consumable', stackable: false, maxStack: 1, value: 0, abilityPool: [], grantedAbilities: [] } as any],
      ]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([['wooden_door', mockDoorTemplate('wooden_door')]]),
      stairs: new Map([
        ['stairs_down', mockStairsTemplate('stairs_down')],
        ['stairs_up', mockStairsTemplate('stairs_up')],
      ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('открывает дверь через INTERACT', () => {
    const player = makePlayer({ x: 3, y: 5, maxAp: 2, ap: 2 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(result.success).toBe(true);

    const updatedDoor = sim.getState().entities.get(door.id) as DoorEntity;
    expect(updatedDoor.isOpen).toBe(true);
    expect(updatedDoor.blocksMovement).toBe(false);
  });

  it('поднимает предмет через INTERACT', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const container = makeFloorItemContainer({
      x: 5,
      y: 5,
      id: 'container_1',
      item: {
        instanceId: 'item_instance_1',
        templateId: 'health_potion',
        quantity: 1,
        grantedAbilities: [],
      },
    });
    const state = makeStateWithPlayerAndEntity(player, container);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: container.id,
    });

    expect(result.success).toBe(true);
    expect(sim.getState().player.inventory.length).toBe(1);
    expect(sim.getState().player.inventory[0]).toMatchObject({
      instanceId: 'item_instance_1',
      templateId: 'health_potion',
    });
    expect(sim.getState().entities.has(container.id)).toBe(false);
  });

  it('переходит на другой этаж через INTERACT', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);
    const oldMap = state.map;

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(result.success).toBe(true);
    expect(sim.getState().floor).toBe(2);
    expect(sim.getState().map).not.toBe(oldMap);
  });
});

describe('INTERACT AP cost', () => {
  it('стоит 1 AP', () => {
    const resolver = new DefaultActionPointCostResolver();
    const state = makeGameState();

    expect(resolver.getCost({ type: 'INTERACT', entityId: 'player', targetId: 'door_1' }, state)).toBe(1);
  });
});

describe('авто-спуск по лестнице удалён', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([['wooden_door', mockDoorTemplate('wooden_door')]]),
      stairs: new Map([
        ['stairs_down', mockStairsTemplate('stairs_down')],
        ['stairs_up', mockStairsTemplate('stairs_up')],
      ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('наступание на лестницу не вызывает автоматический переход', () => {
    const player = makePlayer({ x: 4, y: 5, maxAp: 2, ap: 2 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);
    const oldMap = state.map;

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(true);
    expect(sim.getState().player.x).toBe(5);
    expect(sim.getState().player.y).toBe(5);
    expect(sim.getState().floor).toBe(1);
    expect(sim.getState().map).toBe(oldMap);
  });

  it('переход на другой этаж работает только через INTERACT с лестницей', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, stairs);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs.id,
    });

    expect(result.success).toBe(true);
    expect(sim.getState().floor).toBe(2);
  });

  it('сгенерированная лестница доступна для INTERACT сразу после генерации карты', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    sim.generateMap({
      id: 'test_floor',
      strategy: 'tree',
      width: 50,
      height: 50,
      minRooms: 2,
      maxRooms: 4,
      minRoomSize: 4,
      maxRoomSize: 8,
      enemyDensity: 0,
      itemDensity: 0,
      enemyPool: [],
      itemPool: [],
    });

    const stairs = Array.from(sim.getState().entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_down',
    );
    expect(stairs).toBeDefined();

    // Ключ в Map должен совпадать с entity.id — это и есть суть бага.
    expect(sim.getState().entities.has(stairs!.id)).toBe(true);

    // Перемещаем игрока на клетку с лестницей, чтобы валидация прошла.
    sim.getState().player.x = stairs!.x;
    sim.getState().player.y = stairs!.y;

    const preview = sim.preview({
      type: 'INTERACT',
      entityId: player.id,
      targetId: stairs!.id,
    });
    expect(preview.valid).toBe(true);
  });
});
