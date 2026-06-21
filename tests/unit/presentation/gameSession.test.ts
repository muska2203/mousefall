/**
 * Unit tests for GameSession presentation logic.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import '@i18n/config';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy, makeDoor, makeFloorItem, makeStairs } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { Entity, EntityId } from '../../../src/simulation/types';

describe('GameSession debug mode', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map([
        ['cat_small', {
          id: 'cat_small',
          health: {max: 20},
          combat: {damage: 5, armor: 0},
          baseStats: {str: 1, dex: 1, int: 0, vit: 0},
          aiSightRadius: 6,
          aiStrategyId: 'hunter',
        } as any],
      ]),
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
      doors: new Map([
        ['wooden_door', {id: 'wooden_door', maxHp: 30, armor: 0} as any],
      ]),
      stairs: new Map([
        ['stairs_down', {id: 'stairs_down'} as any],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('debugAddItem adds item to inventory when debug is enabled', () => {
    const player = makePlayer({x: 5, y: 5});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.toggleDebug();
    session.loadGame(state);

    expect(session.isDebug()).toBe(true);

    session.debugAddItem('health_potion');

    const vm = session.getViewModel();
    expect(vm.renderInput?.inventory.length).toBe(1);
    expect(vm.renderInput?.inventory[0]?.templateId).toBe('health_potion');
  });

  it('debugSpawnEntity spawns entity on map when debug is enabled', () => {
    const player = makePlayer({x: 5, y: 5});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.toggleDebug();
    session.loadGame(state);

    session.debugSpawnEntity('item', 'health_potion', {x: 3, y: 3});

    const vm = session.getViewModel();
    const spawned = vm.renderInput?.itemsOnFloor.find(i => i.x === 3 && i.y === 3);
    expect(spawned).toBeDefined();
    expect(spawned?.templateId).toBe('health_potion');
  });

  it('debug actions are rejected when debug is disabled', () => {
    const player = makePlayer({x: 5, y: 5});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    expect(session.isDebug()).toBe(false);

    session.debugAddItem('health_potion');
    session.debugSpawnEntity('item', 'health_potion', {x: 3, y: 3});

    const vm = session.getViewModel();
    expect(vm.renderInput?.inventory.length).toBe(0);
    expect(vm.renderInput?.itemsOnFloor.length).toBe(0);
  });

  it('debugAddItem works after toggling debug on already loaded game', () => {
    const player = makePlayer({x: 5, y: 5});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.loadGame(state);
    expect(session.isDebug()).toBe(false);

    session.toggleDebug();

    expect(session.isDebug()).toBe(true);
    session.debugAddItem('health_potion');

    const vm = session.getViewModel();
    expect(vm.renderInput?.inventory.length).toBe(1);
    expect(vm.renderInput?.inventory[0]?.templateId).toBe('health_potion');
  });

  it('debugSpawnEntity works after toggling debug on already loaded game', () => {
    const player = makePlayer({x: 5, y: 5});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.loadGame(state);
    expect(session.isDebug()).toBe(false);

    session.toggleDebug();

    expect(session.isDebug()).toBe(true);
    session.debugSpawnEntity('item', 'health_potion', {x: 3, y: 3});

    const vm = session.getViewModel();
    const spawned = vm.renderInput?.itemsOnFloor.find(i => i.x === 3 && i.y === 3);
    expect(spawned).toBeDefined();
    expect(spawned?.templateId).toBe('health_potion');
  });
});

describe('GameSession AP display during animations', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('shows intermediate AP (0) during animations and restores AP after they complete', () => {
    // Игрок с 1 AP, враг рядом. MOVE на пустую клетку потратит последний AP,
    // запустит ход окружения и восстановит AP до maxAp.
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const session = new GameSession();
    session.loadGame(state);

    expect(session.getViewModel().renderInput?.playerStats.ap).toBe(1);

    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });

    const vmDuringAnimation = session.getViewModel();
    expect(vmDuringAnimation.renderInput?.phase).toBe('animating');
    // Пока идут анимации, должно отображаться AP после действия игрока (0),
    // а не финальное восстановленное значение.
    expect(vmDuringAnimation.renderInput?.playerStats.ap).toBe(0);

    session.onAnimationsComplete();

    const vmAfterAnimation = session.getViewModel();
    expect(vmAfterAnimation.renderInput?.phase).toBe('idle');
    expect(vmAfterAnimation.renderInput?.playerStats.ap).toBe(1);
  });

  it('shows reduced AP immediately when action does not end the turn', () => {
    // Игрок с 2 AP. MOVE потратит 1 AP, ход не закончится.
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });

    const vm = session.getViewModel();
    // Анимация может быть очень короткой, но renderInput должен показать 1 AP.
    expect(vm.renderInput?.playerStats.ap).toBe(1);
  });
});


describe('GameSession moveOrAttack with doors', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {id: 'wooden_door', maxHp: 30, armor: 0} as any],
      ]),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('opens a closed door instead of attacking', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const door = makeDoor({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [door.id, door]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.moveOrAttack(1, 0);

    const newState = session.getViewModel().renderInput!.state;
    const updatedDoor = newState.entities.get(door.id) as import('../../../src/simulation/types').DoorEntity;
    expect(updatedDoor.isOpen).toBe(true);
    expect(updatedDoor.blocksMovement).toBe(false);
    expect(newState.player.x).toBe(5);
    expect(newState.player.y).toBe(5);
    expect(newState.player.ap).toBe(1);
  });

  it('moves onto an open door tile instead of attacking', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const door = makeDoor({ x: 6, y: 5, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [door.id, door]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.moveOrAttack(1, 0);
    session.onAnimationsComplete();

    const newState = session.getViewModel().renderInput!.state;
    const updatedDoor = newState.entities.get(door.id) as import('../../../src/simulation/types').DoorEntity;
    expect(updatedDoor.hp).toBe(door.hp);
    expect(newState.player.x).toBe(6);
    expect(newState.player.y).toBe(5);
    expect(newState.player.ap).toBe(1);
  });

  it('does not auto-move into a door after opening it while key is held', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const door = makeDoor({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [door.id, door]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    // Имитируем зажатую клавишу движения.
    session.setHeldDirection(1, 0);
    session.moveOrAttack(1, 0);
    session.onAnimationsComplete();

    const newState = session.getViewModel().renderInput!.state;
    const updatedDoor = newState.entities.get(door.id) as import('../../../src/simulation/types').DoorEntity;
    expect(updatedDoor.isOpen).toBe(true);
    // Персонаж должен остаться на месте, а не автоматически заходить в дверь.
    expect(newState.player.x).toBe(5);
    expect(newState.player.y).toBe(5);
    expect(newState.player.ap).toBe(1);
  });
});

describe('GameSession interactions (F / Tab)', () => {
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
      doors: new Map([
        ['wooden_door', {id: 'wooden_door', maxHp: 30, armor: 0} as any],
      ]),
      stairs: new Map([
        ['stairs_down', {id: 'stairs_down'} as any],
        ['stairs_up', {id: 'stairs_up'} as any],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('shows pickup hint when an item is on player tile', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItem({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [item.id, item]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    const hint = session.getViewModel().renderInput?.interactionHint;
    expect(hint).toBeDefined();
    expect(hint?.targetPosition).toEqual({ x: 5, y: 5 });
    expect(hint?.hasMultiple).toBe(false);
  });

  it('shows descend hint when stairs_down is on player tile', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 1,
      entities: new Map<EntityId, Entity>([[player.id, player], [stairs.id, stairs]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    const hint = session.getViewModel().renderInput?.interactionHint;
    expect(hint).toBeDefined();
    expect(hint?.label).toContain('Спуститься');
  });

  it('shows ascend hint when stairs_up is on player tile above floor 1', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_up', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 2,
      entities: new Map<EntityId, Entity>([[player.id, player], [stairs.id, stairs]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    const hint = session.getViewModel().renderInput?.interactionHint;
    expect(hint).toBeDefined();
    expect(hint?.label).toContain('Подняться');
  });

  it('prioritizes pickup over stairs when both are present', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItem({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 1,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [item.id, item],
        [stairs.id, stairs],
      ]),
    });

    const session = new GameSession();
    session.loadGame(state);

    const hint = session.getViewModel().renderInput?.interactionHint;
    expect(hint?.hasMultiple).toBe(true);
    expect(hint?.label).toContain('Поднять');
  });

  it('Tab cycles interaction options', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItem({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 1,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [item.id, item],
        [stairs.id, stairs],
      ]),
    });

    const session = new GameSession();
    session.loadGame(state);

    expect(session.getViewModel().renderInput?.interactionHint?.label).toContain('Поднять');
    session.cycleInteraction(1);
    expect(session.getViewModel().renderInput?.interactionHint?.label).toContain('Спуститься');
    session.cycleInteraction(1);
    expect(session.getViewModel().renderInput?.interactionHint?.label).toContain('Поднять');
  });

  it('performSelectedInteraction dispatches PICKUP when item is selected', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1 });
    const item = makeFloorItem({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [item.id, item]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.performSelectedInteraction();
    session.onAnimationsComplete();

    expect(session.getViewModel().renderInput?.inventory.length).toBe(1);
  });

  it('performSelectedInteraction dispatches DESCEND when stairs_down is selected', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 1,
      entities: new Map<EntityId, Entity>([[player.id, player], [stairs.id, stairs]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.performSelectedInteraction();

    expect(session.getViewModel().mode).toBe('playing');
    // После DESCEND симуляция выполняет переход этажа.
    expect(session.getViewModel().renderInput?.state.floor).toBe(2);
  });

  it('resets selected index when player moves', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1 });
    const item = makeFloorItem({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      floor: 1,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [item.id, item],
        [stairs.id, stairs],
      ]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.cycleInteraction(1);
    expect(session.getViewModel().renderInput?.interactionHint?.label).toContain('Спуститься');

    // Перемещаем игрока через MOVE и дожидаемся завершения анимации.
    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    session.onAnimationsComplete();

    const hint = session.getViewModel().renderInput?.interactionHint;
    // На новой клетке взаимодействий нет — подсказка должна исчезнуть.
    expect(hint).toBeNull();
  });
});
