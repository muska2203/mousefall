/**
 * Unit tests for GameSession presentation logic.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
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
