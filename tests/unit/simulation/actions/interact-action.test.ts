/**
 * Тесты единого action взаимодействия `INTERACT`.
 *
 * Блок 1: проверяем тип action, resolveInteraction и базовую валидацию.
 * Исполнение конкретных intent'ов пока не тестируется — оно добавится в Блоке 3.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { interactAction } from '../../../../src/simulation/systems/actions/interact-action';
import { resolveInteraction } from '../../../../src/simulation/systems/interactions/resolve-interaction';
import { DefaultActionPointCostResolver } from '../../../../src/simulation/systems/action-cost-resolver';
import { makeGameState, makePlayer, makeDoor, makeStairs, makeStateWithPlayerAndEntity } from '../../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { MAX_FLOOR } from '../../../../src/utils/constants';
import type { DoorEntity, StairsEntity } from '../../../../src/simulation/types';

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

  it('возвращает null для сущности без interactionKind', () => {
    const player = makePlayer();
    const enemy = { id: 'enemy_test_1', type: 'enemy', x: 5, y: 5 } as any;
    const state = makeGameState({ entities: new Map([[enemy.id, enemy]]) });

    const result = resolveInteraction(state, enemy, player);
    expect(result).toBeNull();
  });
});

describe('interactAction.validate', () => {
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

  it('resolve возвращает пустой массив на первом блоке', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const door = makeDoor({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, door);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: door.id,
    });

    expect(intents).toEqual([]);
  });
});

describe('INTERACT AP cost', () => {
  it('стоит 1 AP', () => {
    const resolver = new DefaultActionPointCostResolver();
    const state = makeGameState();

    expect(resolver.getCost({ type: 'INTERACT', entityId: 'player', targetId: 'door_1' }, state)).toBe(1);
  });
});
