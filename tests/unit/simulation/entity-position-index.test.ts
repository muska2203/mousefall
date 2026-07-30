import {describe, expect, it} from 'vitest';
import {
  buildEntityPositionIndex,
  blocksLOS,
  findAllEntitiesAt,
  findDoorAt,
  isBlocked,
  positionKey,
} from '@simulation/state';
import {makeDoor, makeEnemy, makeGameState, makePlayer, makeProp} from '../../fixtures/gameState.ts';
import type {Entity, EntityId} from '@simulation/types';

describe('buildEntityPositionIndex', () => {
  it('группирует сущности по клеткам', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemyA = makeEnemy({ id: 'enemy_a', x: 3, y: 3 });
    const enemyB = makeEnemy({ id: 'enemy_b', x: 3, y: 3 });
    const entities = new Map<EntityId, Entity>([
      [player.id, player],
      [enemyA.id, enemyA],
      [enemyB.id, enemyB],
    ]);

    const index = buildEntityPositionIndex(entities);

    expect(index.get(positionKey(5, 5))).toEqual([player]);
    expect(index.get(positionKey(3, 3))).toEqual([enemyA, enemyB]);
    expect(index.get(positionKey(0, 0))).toBeUndefined();
  });

  it('findAllEntitiesAt с индексом эквивалентен скану без индекса', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const door = makeDoor({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy], [door.id, door]]),
    });
    const index = buildEntityPositionIndex(state.entities);

    for (const [x, y] of [[5, 5], [6, 5], [1, 1], [0, 0]] as const) {
      expect(findAllEntitiesAt(state, x, y, index)).toEqual(findAllEntitiesAt(state, x, y));
    }
  });
});

describe('read-хелперы с позиционным индексом', () => {
  it('isBlocked и blocksLOS с индексом дают те же результаты, что без него', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const closedDoor = makeDoor({ id: 'door_closed', x: 4, y: 5, isOpen: false });
    const blockingProp = makeProp({ id: 'prop_los', x: 7, y: 5, blocksLOS: true });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [closedDoor.id, closedDoor], [blockingProp.id, blockingProp]]),
    });
    const index = buildEntityPositionIndex(state.entities);

    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        expect(isBlocked(state, x, y, index)).toBe(isBlocked(state, x, y));
        expect(blocksLOS(state, x, y, index)).toBe(blocksLOS(state, x, y));
      }
    }
  });

  it('findDoorAt с индексом находит ту же дверь', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [door.id, door]]),
    });
    const index = buildEntityPositionIndex(state.entities);

    expect(findDoorAt(state, 4, 5, index)).toBe(door);
    expect(findDoorAt(state, 1, 1, index)).toBeUndefined();
  });
});
