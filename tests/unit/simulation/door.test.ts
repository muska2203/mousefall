/**
 * Тесты объекта "дверь".
 *
 * Проверяем базовые свойства:
 * - дверь непроходима в закрытом состоянии;
 * - дверь блокирует линию видимости в закрытом состоянии;
 * - открытая дверь проходима и не блокирует обзор;
 * - дверь может быть открыта и закрыта с соседней клетки;
 * - дверь может быть атакована и разрушена.
 */

import { describe, it, expect } from 'vitest';
import { isBlocked, blocksLOS, findFirstAttackableEntityAt, findDoorAt } from '../../../src/simulation/state';
import { attackEntity } from '../../../src/simulation/systems/actions/attack-action';
import { GameSimulation } from '../../../src/simulation/simulation';
import type { DoorEntity, EntityId, Entity } from '../../../src/simulation/types';
import { makeGameState, makePlayer, makeEnemy, makeDoor, makeStateWithPlayerAndEntity } from '../../fixtures/gameState';

describe('Door entity', () => {
  it('blocks movement when closed', () => {
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeGameState({
      entities: new Map([[door.id, door]]),
    });

    expect(isBlocked(state, 4, 5)).toBe(true);
  });

  it('blocks line of sight while closed and alive', () => {
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeGameState({
      entities: new Map([[door.id, door]]),
    });

    expect(blocksLOS(state, 4, 5)).toBe(true);
  });

  it('does not block line of sight when destroyed', () => {
    const door = makeDoor({ x: 4, y: 5, isAlive: false });
    const state = makeGameState({
      entities: new Map([[door.id, door]]),
    });

    expect(blocksLOS(state, 4, 5)).toBe(false);
  });

  it('does not block movement or line of sight when open', () => {
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      entities: new Map([[door.id, door]]),
    });

    expect(isBlocked(state, 4, 5)).toBe(false);
    expect(blocksLOS(state, 4, 5)).toBe(false);
  });

  it('is found by findDoorAt', () => {
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeGameState({
      entities: new Map([[door.id, door]]),
    });

    const found = findDoorAt(state, 4, 5);
    expect(found).toBeDefined();
    expect(found?.id).toBe(door.id);
  });

  it('is attackable', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const target = findFirstAttackableEntityAt(state, 4, 5);
    expect(target).toBeDefined();
    expect(target?.type).toBe('door');
  });

  it('takes damage and can be destroyed by attack', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10 });
    const door = makeDoor({ x: 4, y: 5, hp: 5, maxHp: 5, armor: 0 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const validation = attackEntity.validate(state, {
      type: 'ATTACK',
      entityId: player.id,
      dx: 1,
      dy: 0,
    });
    expect(validation.ok).toBe(true);

    const intents = attackEntity.resolve(state, {
      type: 'ATTACK',
      entityId: player.id,
      dx: 1,
      dy: 0,
    });

    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0]!.type).toBe('DAMAGE');
  });

  it('takes reduced damage from melee attack based on armor', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10, baseStats: { str: 9, dex: 0, int: 0, vit: 0 }, maxAp: 2, ap: 2 });
    const door = makeDoor({ x: 4, y: 5, hp: 30, maxHp: 30, armor: 2 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    const updatedDoor = sim.getState().entities.get(door.id) as DoorEntity;
    expect(updatedDoor).toBeDefined();
    expect(updatedDoor.hp).toBe(22);
    expect(updatedDoor.isAlive).toBe(true);
  });

  it('is destroyed when melee attack reduces hp to zero', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10, baseStats: { str: 9, dex: 0, int: 0, vit: 0 }, maxAp: 1, ap: 1 });
    const door = makeDoor({ x: 4, y: 5, hp: 8, maxHp: 8, armor: 2 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    expect(sim.getState().entities.has(door.id)).toBe(false);
  });

  it('can be opened from an adjacent tile', () => {
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
    expect(isBlocked(sim.getState(), 4, 5)).toBe(false);
    expect(blocksLOS(sim.getState(), 4, 5)).toBe(false);
  });

  it('can be closed from an adjacent tile', () => {
    const player = makePlayer({ x: 3, y: 5, maxAp: 2, ap: 2 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });
    expect(result.success).toBe(true);

    const updatedDoor = sim.getState().entities.get(door.id) as DoorEntity;
    expect(updatedDoor.isOpen).toBe(false);
    expect(updatedDoor.blocksMovement).toBe(true);
    expect(isBlocked(sim.getState(), 4, 5)).toBe(true);
    expect(blocksLOS(sim.getState(), 4, 5)).toBe(true);
  });

  it('INTERACT toggles an open door closed', () => {
    const player = makePlayer({ x: 3, y: 5, maxAp: 2, ap: 2 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const state = makeStateWithPlayerAndEntity(player, door);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });
    expect(result.success).toBe(true);

    const updatedDoor = sim.getState().entities.get(door.id) as DoorEntity;
    expect(updatedDoor.isOpen).toBe(false);
    expect(updatedDoor.blocksMovement).toBe(true);
  });

  it('cannot close a door if its tile is blocked by another entity', () => {
    const player = makePlayer({ x: 3, y: 5, maxAp: 2, ap: 2 });
    const door = makeDoor({ x: 4, y: 5, isOpen: true, blocksMovement: false });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 4, y: 5, blocksMovement: true });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [door.id, door],
        [enemy.id, enemy],
      ]),
    });

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });
    expect(result.success).toBe(false);
  });
});
