/**
 * Юнит-тесты контроллера запирания босс-комнаты (roadMap 1.3).
 *
 * Реакции вызываются напрямую с подготовленным состоянием:
 * - bossRoomDoorReaction на ENTITY_MOVED (вход/выход игрока);
 * - bossRoomUnlockOnBossDeathReaction на ENTITY_DIED (смерть последнего босса).
 *
 * Сквозной сценарий через GameSimulation — в
 * `tests/integration/boss-room-locking.test.ts`.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  bossRoomDoorReaction,
  bossRoomUnlockOnBossDeathReaction,
} from '@simulation/systems/world-reactions/boss-room-reaction';
import type {EntityMovedEvent, EntityDiedEvent} from '@simulation/core-types';
import type {EntityId, Entity, GameState} from '@simulation/types';
import {
  initObjectContentRegistry,
  makeDoor,
  makeEnemy,
  makeGameState,
  makePlayer,
} from '../../../fixtures/gameState';
import {resetRegistry} from '../../../../src/content/registry';
import type {EntityTemplate} from '../../../../src/content/schemas';

function makeEntityTemplate(partial: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    id: 'test_enemy',
    health: {max: 10},
    baseStats: {str: 0, dex: 0, int: 0, vit: 0},
    equipment: {},
    abilities: [],
    lootTable: [],
    lootDropTable: [],
    aiSightRadius: 6,
    aiStrategyId: 'hunter',
    maxAp: 1,
    isBoss: false,
    ...partial,
  };
}

/** Босс-комната: x 5..8, y 2..7. */
const BOSS_ROOM = {x: 5, y: 2, width: 4, height: 6, roomTypeId: 'boss'};

function makeBossRoomState() {
  const player = makePlayer({x: 3, y: 4});
  const boss = makeEnemy({id: 'boss_1', templateId: 'test_boss', x: 6, y: 4});
  const doorA = makeDoor({id: 'door_a', templateId: 'boss_door', x: 4, y: 4, isOpen: true, blocksMovement: false});
  const doorB = makeDoor({id: 'door_b', templateId: 'boss_door', x: 4, y: 6});
  const wooden = makeDoor({id: 'door_w', templateId: 'wooden_door', x: 2, y: 7, isOpen: true, blocksMovement: false});
  const state = makeGameState({
    player,
    entities: new Map<EntityId, Entity>([
      [player.id, player],
      [boss.id, boss],
      [doorA.id, doorA],
      [doorB.id, doorB],
      [wooden.id, wooden],
    ]),
  });
  state.map.rooms = [BOSS_ROOM, {x: 1, y: 1, width: 3, height: 8, roomTypeId: 'normal'}];
  return {state, player, boss, doorA, doorB, wooden};
}

function movedEvent(
  entityId: string,
  from: {x: number; y: number},
  to: {x: number; y: number},
  movementType: EntityMovedEvent['movementType'] = 'walk',
): EntityMovedEvent {
  return {type: 'ENTITY_MOVED', isFieldEvent: true, entityId, from, to, movementType};
}

function diedEvent(entityId: string, position: {x: number; y: number}): EntityDiedEvent {
  return {type: 'ENTITY_DIED', isFieldEvent: true, entityId, position, sourceEntityId: null};
}

function callDoorReaction(state: GameState, event: EntityMovedEvent) {
  return bossRoomDoorReaction(state, event, null as any, null as any);
}

function callDeathReaction(state: GameState, event: EntityDiedEvent) {
  return bossRoomUnlockOnBossDeathReaction(state, event, null as any, null as any);
}

describe('bossRoomDoorReaction (ENTITY_MOVED)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      entities: new Map([
        ['test_boss', makeEntityTemplate({id: 'test_boss', isBoss: true})],
        ['test_enemy', makeEntityTemplate({id: 'test_enemy'})],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('вход игрока при живом боссе внутри: LOCK_DOOR всем босс-дверям (открытую закрывает исполнитель)', () => {
    const {state} = makeBossRoomState();

    const intents = callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}));

    // CLOSE_DOOR отдельным интентом не эмитится: исполнитель LOCK_DOOR сам
    // закрывает открытую дверь с событием DOOR_CLOSED.
    expect(intents).toEqual([
      {type: 'LOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 4}},
      {type: 'LOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 6}},
    ]);
  });

  it('обычная дверь (wooden_door) не затрагивается', () => {
    const {state} = makeBossRoomState();

    const intents = callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}));

    const doorIntents = intents.filter(
      (i) => i.type === 'CLOSE_DOOR' || i.type === 'LOCK_DOOR' || i.type === 'UNLOCK_DOOR',
    );
    expect(doorIntents.every((i) => i.targetPosition.x !== 2 || i.targetPosition.y !== 7)).toBe(true);
  });

  it('вход при мёртвом боссе: не запирается', () => {
    const {state, boss} = makeBossRoomState();
    boss.isAlive = false;

    expect(callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}))).toEqual([]);
  });

  it('вход при живом боссе вне комнаты: не запирается (босс не должен застрять снаружи)', () => {
    const {state, boss} = makeBossRoomState();
    boss.x = 2;
    boss.y = 2;

    expect(callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}))).toEqual([]);
  });

  it('повторный вход при уже запертых дверях: LOCK_DOOR эмитится (идемпотентно)', () => {
    const {state, doorA, doorB} = makeBossRoomState();
    doorA.isLocked = true;
    doorB.isLocked = true;

    const intents = callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}));

    expect(intents.filter((i) => i.type === 'LOCK_DOOR').length).toBe(2);
  });

  it('телепорт/рывок игрока в комнату — тоже запирает (by design)', () => {
    const {state} = makeBossRoomState();

    const intents = callDoorReaction(state, movedEvent('player', {x: 1, y: 1}, {x: 6, y: 4}, 'teleport'));

    expect(intents.some((i) => i.type === 'LOCK_DOOR')).toBe(true);
  });

  it('перемещение внутри комнаты: ничего не делает', () => {
    const {state} = makeBossRoomState();

    expect(callDoorReaction(state, movedEvent('player', {x: 5, y: 4}, {x: 6, y: 4}))).toEqual([]);
  });

  it('перемещение снаружи комнаты: ничего не делает', () => {
    const {state} = makeBossRoomState();

    expect(callDoorReaction(state, movedEvent('player', {x: 2, y: 4}, {x: 3, y: 4}))).toEqual([]);
  });

  it('перемещение не-игрока (врага): ничего не делает', () => {
    const {state} = makeBossRoomState();

    expect(callDoorReaction(state, movedEvent('boss_1', {x: 4, y: 4}, {x: 5, y: 4}))).toEqual([]);
  });

  it('карта без босс-комнаты (нет bossPool): ничего не делает', () => {
    const {state} = makeBossRoomState();
    state.map.rooms = [{x: 1, y: 1, width: 8, height: 8, roomTypeId: 'normal'}];

    expect(callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}))).toEqual([]);
  });

  it('выход при живом боссе в комнате: UNLOCK_DOOR всем босс-дверям', () => {
    const {state} = makeBossRoomState();

    const intents = callDoorReaction(state, movedEvent('player', {x: 5, y: 4}, {x: 4, y: 4}));

    expect(intents).toEqual([
      {type: 'UNLOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 4}},
      {type: 'UNLOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 6}},
    ]);
  });

  it('выход при живом боссе вне комнаты: тоже отпирает (жив хоть один босс)', () => {
    const {state, boss} = makeBossRoomState();
    boss.x = 2;
    boss.y = 2;

    const intents = callDoorReaction(state, movedEvent('player', {x: 5, y: 4}, {x: 4, y: 4}));

    expect(intents.some((i) => i.type === 'UNLOCK_DOOR')).toBe(true);
  });

  it('выход при мёртвом боссе: ничего не делает (отпирание — задача реакции на смерть)', () => {
    const {state, boss} = makeBossRoomState();
    boss.isAlive = false;

    expect(callDoorReaction(state, movedEvent('player', {x: 5, y: 4}, {x: 4, y: 4}))).toEqual([]);
  });

  it('мёртвая (разрушенная) босс-дверь не получает интентов', () => {
    const {state, doorA} = makeBossRoomState();
    doorA.isAlive = false;

    const intents = callDoorReaction(state, movedEvent('player', {x: 4, y: 4}, {x: 5, y: 4}));

    expect(intents).toEqual([
      {type: 'LOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 6}},
    ]);
  });
});

describe('bossRoomUnlockOnBossDeathReaction (ENTITY_DIED)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      entities: new Map([
        ['test_boss', makeEntityTemplate({id: 'test_boss', isBoss: true})],
        ['test_enemy', makeEntityTemplate({id: 'test_enemy'})],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('смерть последнего босса: UNLOCK_DOOR всем живым босс-дверям', () => {
    const {state, boss} = makeBossRoomState();
    // die-intent-executer выставляет isAlive=false до эмита ENTITY_DIED.
    boss.isAlive = false;

    const intents = callDeathReaction(state, diedEvent(boss.id, {x: boss.x, y: boss.y}));

    expect(intents).toEqual([
      {type: 'UNLOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 4}},
      {type: 'UNLOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 6}},
    ]);
  });

  it('смерть босса при живом втором боссе: не отпирает', () => {
    const {state, boss} = makeBossRoomState();
    boss.isAlive = false;
    const boss2 = makeEnemy({id: 'boss_2', templateId: 'test_boss', x: 8, y: 7});
    state.entities.set(boss2.id, boss2);

    expect(callDeathReaction(state, diedEvent(boss.id, {x: boss.x, y: boss.y}))).toEqual([]);
  });

  it('смерть обычного врага: ничего не делает', () => {
    const {state} = makeBossRoomState();
    const enemy = makeEnemy({id: 'enemy_1', templateId: 'test_enemy', x: 2, y: 2, isAlive: false});
    state.entities.set(enemy.id, enemy);

    expect(callDeathReaction(state, diedEvent(enemy.id, {x: 2, y: 2}))).toEqual([]);
  });

  it('смерть босса: мёртвые двери не получают интентов', () => {
    const {state, boss, doorA} = makeBossRoomState();
    boss.isAlive = false;
    doorA.isAlive = false;

    const intents = callDeathReaction(state, diedEvent(boss.id, {x: boss.x, y: boss.y}));

    expect(intents).toEqual([
      {type: 'UNLOCK_DOOR', entityId: 'player', targetPosition: {x: 4, y: 6}},
    ]);
  });
});
