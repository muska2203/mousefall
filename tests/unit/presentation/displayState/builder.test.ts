/**
 * Unit tests for DisplayState core.
 */

import { describe, expect, it } from 'vitest';
import type { Entity, GameEvent, GameState } from '../../../../src/simulation/types';
import type { TileEffectInstance, TileEffects } from '../../../../src/simulation/core-types';
import {
  buildDisplayState,
  createPatch,
  applyPatch,
} from '../../../../src/presentation/displayState/builder';
import { resyncDisplayState } from '../../../../src/presentation/displayState/sync';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  makeDoor,
  makeFloorItemContainer,
} from '../../../fixtures/gameState';
import { PLAYER_ID } from '../../../../src/utils/constants';
import type { DisplayPatch } from '../../../../src/presentation/displayState/types';

function makeMinimalState(): GameState {
  return makeGameState({
    player: makePlayer({ x: 5, y: 5 }),
    entities: new Map(),
  });
}

function buildStateWithDoorAndItem(): GameState {
  const player = makePlayer({ x: 5, y: 5 });
  const door = makeDoor({ id: 'door_1', x: 4, y: 5 });
  const item = makeFloorItemContainer({ id: 'item_1', x: 6, y: 5 });
  return makeGameState({
    player,
    entities: new Map<string, Entity>([
      [player.id, player],
      [door.id, door],
      [item.id, item],
    ]),
    visible: Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => x === 5 && y === 5),
    ),
    explored: Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => x === 5 && y === 5),
    ),
  });
}

describe('buildDisplayState', () => {
  it('builds initial state from GameState', () => {
    const state = buildStateWithDoorAndItem();
    const display = buildDisplayState(state);

    expect(display.map.width).toBe(10);
    expect(display.map.height).toBe(10);
    expect(display.map.tiles[5]![5]!.type).toBe('floor');
    expect(display.map.visible[5]![5]).toBe(true);
    expect(display.map.explored[5]![5]).toBe(true);

    expect(display.player.id).toBe(PLAYER_ID);
    expect(display.player.x).toBe(5);
    expect(display.player.y).toBe(5);
    expect(display.player.hp).toBe(100);
    expect(display.player.maxHp).toBe(100);
    expect(display.player.isAlive).toBe(true);
    expect(display.player.level).toBe(1);
    expect(display.player.statusEffects).toEqual([]);

    expect(display.entities.size).toBe(3);
    expect(display.entities.get('door_1')!.isOpen).toBe(false);
    expect(display.entities.get('item_1')!.type).toBe('floor_item_container');

    expect(display.meta.floor).toBe(1);
    expect(display.meta.round).toBe(0);
    expect(display.meta.turnSide).toBe('player');
    expect(display.meta.phase).toBe('playing');
  });

  it('copies grids and entities, not sharing references', () => {
    const state = buildStateWithDoorAndItem();
    const display = buildDisplayState(state);

    expect(display.map.visible).not.toBe(state.visible);
    expect(display.map.explored).not.toBe(state.explored);
    expect(display.entities.get(PLAYER_ID)).not.toBe(state.player);
  });

  it('collects tile effect overlays with correct renderOrder including statuses', () => {
    const state = makeGameState({
      player: makePlayer({ x: 5, y: 5 }),
      entities: new Map(),
    });
    const tileEffects = state.tileEffects as TileEffects[][];
    tileEffects[5]![5]! = {
      oil: {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 3, renderOrder: 2 }],
        renderOrder: 1,
      } satisfies TileEffectInstance,
    };

    const display = buildDisplayState(state);
    expect(display.map.tiles[5]![5]!.tileEffects).toEqual([
      { type: 'oil', renderOrder: 1 },
      { type: 'burning', renderOrder: 2 },
    ]);
  });
});

describe('createPatch', () => {
  it('maps ENTITY_MOVED to position patch', () => {
    const event: GameEvent = {
      type: 'ENTITY_MOVED',
      entityId: 'player',
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
      movementType: 'walk',
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'ENTITY_MOVED',
      entityId: 'player',
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
    });
  });

  it('maps ENTITY_DAMAGED to hp patch', () => {
    const event: GameEvent = {
      type: 'ENTITY_DAMAGED',
      targetId: 'enemy_test_1',
      sourceEntityId: null,
      damage: 7,
      position: { x: 3, y: 3 },
      tags: ['damage.physical'],
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'ENTITY_DAMAGED',
      entityId: 'enemy_test_1',
      damage: 7,
    });
  });

  it('maps ENTITY_HEALED to heal patch', () => {
    const event: GameEvent = {
      type: 'ENTITY_HEALED',
      entityId: PLAYER_ID,
      amount: 10,
      newHp: 90,
      position: { x: 5, y: 5 },
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'ENTITY_HEALED',
      entityId: PLAYER_ID,
      amount: 10,
      newHp: 90,
    });
  });

  it('maps ENTITY_DIED to death patch', () => {
    const event: GameEvent = {
      type: 'ENTITY_DIED',
      entityId: 'enemy_test_1',
      position: { x: 3, y: 3 },
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({ type: 'ENTITY_DIED', entityId: 'enemy_test_1' });
  });

  it('maps STATUS_APPLIED to status patch', () => {
    const effect = { type: 'poisoned', duration: 3, value: 2 } as any;
    const event: GameEvent = {
      type: 'STATUS_APPLIED',
      entityId: 'enemy_test_1',
      sourceEntityId: null,
      effect,
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'STATUS_APPLIED',
      entityId: 'enemy_test_1',
      effect,
    });
  });

  it('maps STATUS_REMOVED to status removal patch', () => {
    const event: GameEvent = {
      type: 'STATUS_REMOVED',
      entityId: 'enemy_test_1',
      effectType: 'poisoned',
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'STATUS_REMOVED',
      entityId: 'enemy_test_1',
      effectType: 'poisoned',
    });
  });

  it('returns NO_OP for STATUS_BLOCKED', () => {
    const event: GameEvent = {
      type: 'STATUS_BLOCKED',
      entityId: 'enemy_test_1',
      sourceEntityId: null,
      statusType: 'burning',
      blockedBy: 'frozen',
    };
    expect(createPatch(event, makeMinimalState())).toEqual({ type: 'NO_OP' });
  });

  it('maps FOG_UPDATED to full visibility/explored snapshot', () => {
    const visible = Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => (x === 5 || x === 6) && y === 5),
    );
    const explored = Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => (x >= 5 && x <= 7) && y === 5),
    );
    const state = makeGameState({
      player: makePlayer({ x: 5, y: 5 }),
      entities: new Map(),
      visible,
      explored,
    });
    const event: GameEvent = {
      type: 'FOG_UPDATED',
      newlyVisible: [{ x: 6, y: 5 }],
    };
    const patch = createPatch(event, state);
    expect(patch).toEqual({
      type: 'FOG_UPDATED',
      visible: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
      explored: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
    });
  });

  it('maps DOOR_OPENED to door patch', () => {
    const event: GameEvent = { type: 'DOOR_OPENED', position: { x: 4, y: 5 } };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({ type: 'DOOR_OPENED', position: { x: 4, y: 5 } });
  });

  it('maps ITEM_DROPPED to container spawn patch', () => {
    const event: GameEvent = {
      type: 'ITEM_DROPPED',
      dropperEntityId: 'enemy_test_1',
      itemInstanceId: 'item_1',
      containerId: 'floor_container_1',
      templateId: 'health_potion',
      position: { x: 3, y: 3 },
      from: { x: 2, y: 3 },
    };
    const patch = createPatch(event, makeMinimalState());
    expect(patch).toEqual({
      type: 'ITEM_DROPPED',
      container: {
        id: 'floor_container_1',
        type: 'floor_item_container',
        x: 3,
        y: 3,
        templateId: 'health_potion',
        statusEffects: [],
      },
    });
  });

  it('returns NO_OP for non-visual events', () => {
    const action: GameEvent = {
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: PLAYER_ID, dx: 1, dy: 0 },
    };
    expect(createPatch(action, makeMinimalState())).toEqual({ type: 'NO_OP' });

    const resource: GameEvent = {
      type: 'RESOURCE_CONSUMED',
      entityId: PLAYER_ID,
      resource: 'ap',
      amount: 1,
      remaining: 0,
    };
    expect(createPatch(resource, makeMinimalState())).toEqual({ type: 'NO_OP' });

    const cooldown: GameEvent = {
      type: 'COOLDOWN_SET',
      entityId: PLAYER_ID,
      abilityId: 'dash',
      turns: 2,
    };
    expect(createPatch(cooldown, makeMinimalState())).toEqual({ type: 'NO_OP' });
  });

  it('maps TILE_EFFECT_CHANGED to overlay patch from state', () => {
    const state = makeGameState({
      player: makePlayer({ x: 5, y: 5 }),
      entities: new Map(),
    });
    const tileEffects = state.tileEffects as TileEffects[][];
    tileEffects[3]![3]! = {
      oil: {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 3, renderOrder: 2 }],
        renderOrder: 1,
      } satisfies TileEffectInstance,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      isNew: true,
    };
    const patch = createPatch(event, state);
    expect(patch).toEqual({
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [
        { type: 'oil', renderOrder: 1 },
        { type: 'burning', renderOrder: 2 },
      ],
    });
  });

  it('maps TILE_EFFECT_REMOVED to overlay patch from state', () => {
    const state = makeGameState({
      player: makePlayer({ x: 5, y: 5 }),
      entities: new Map(),
    });
    const tileEffects = state.tileEffects as TileEffects[][];
    tileEffects[3]![3]! = {
      water: {
        type: 'water',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      } satisfies TileEffectInstance,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_REMOVED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
    };
    const patch = createPatch(event, state);
    expect(patch).toEqual({
      type: 'TILE_EFFECT_REMOVED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [{ type: 'water', renderOrder: 1 }],
    });
  });

  it('maps TILE_EFFECT_STATUS_APPLIED to overlay patch from state', () => {
    const state = makeGameState({
      player: makePlayer({ x: 5, y: 5 }),
      entities: new Map(),
    });
    const tileEffects = state.tileEffects as TileEffects[][];
    tileEffects[3]![3]! = {
      oil: {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [
          { type: 'burning', duration: 3, renderOrder: 2 },
        ],
        renderOrder: 1,
      } satisfies TileEffectInstance,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_STATUS_APPLIED',
      effectType: 'oil',
      statusType: 'burning',
      position: { x: 3, y: 3 },
      duration: 3,
    };
    const patch = createPatch(event, state);
    expect(patch).toEqual({
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [
        { type: 'oil', renderOrder: 1 },
        { type: 'burning', renderOrder: 2 },
      ],
    });
  });

  it('returns NO_OP for TILE_EFFECT_STATUS_TICKED and TILE_EFFECT_TICKED', () => {
    const tickedStatus: GameEvent = {
      type: 'TILE_EFFECT_STATUS_TICKED',
      effectType: 'oil',
      statusType: 'burning',
      position: { x: 3, y: 3 },
    };
    expect(createPatch(tickedStatus, makeMinimalState())).toEqual({ type: 'NO_OP' });

    const ticked: GameEvent = {
      type: 'TILE_EFFECT_TICKED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
    };
    expect(createPatch(ticked, makeMinimalState())).toEqual({ type: 'NO_OP' });
  });
});

describe('applyPatch', () => {
  it('updates entity position', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({
      type: 'ENTITY_MOVED',
      entityId: PLAYER_ID,
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
      movementType: 'walk',
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.player.x).toBe(6);
    expect(next.player.y).toBe(5);
    expect(state.player.x).toBe(5);
  });

  it('reduces HP on damage and clamps to zero', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({
      type: 'ENTITY_DAMAGED',
      targetId: PLAYER_ID,
      sourceEntityId: null,
      damage: 120,
      position: { x: 5, y: 5 },
      tags: ['damage.physical'],
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.player.hp).toBe(0);
    expect(state.player.hp).toBe(100);
  });

  it('heals HP and clamps to maxHp', () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    const state = buildDisplayState(makeGameState({ player, entities: new Map([[player.id, player]]) }));
    const patch = createPatch({
      type: 'ENTITY_HEALED',
      entityId: PLAYER_ID,
      amount: 100,
      newHp: 200,
      position: { x: 5, y: 5 },
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.player.hp).toBe(100);
  });

  it('adds and removes status effects', () => {
    const player = makePlayer({
      statusEffects: [{ type: 'burning', duration: 2, value: 3 } as any],
    });
    const state = buildDisplayState(makeGameState({ player, entities: new Map([[player.id, player]]) }));

    const applied = createPatch({
      type: 'STATUS_APPLIED',
      entityId: PLAYER_ID,
      sourceEntityId: null,
      effect: { type: 'poisoned', duration: 5, value: 2 } as any,
    }, makeMinimalState());
    const withPoison = applyPatch(state, applied);
    expect(withPoison.player.statusEffects!.map((e) => e.type)).toEqual(['burning', 'poisoned']);

    const removed = createPatch({
      type: 'STATUS_REMOVED',
      entityId: PLAYER_ID,
      effectType: 'burning',
    }, makeMinimalState());
    const withoutBurning = applyPatch(withPoison, removed);
    expect(withoutBurning.player.statusEffects!.map((e) => e.type)).toEqual(['poisoned']);
  });

  it('updates visibility and exploration on FOG_UPDATED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch: DisplayPatch = {
      type: 'FOG_UPDATED',
      visible: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
      explored: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
    };
    const next = applyPatch(state, patch);

    expect(next.map.visible[5]![6]).toBe(true);
    expect(next.map.explored[5]![6]).toBe(true);
    expect(next.map.visible[5]![7]).toBe(true);
    expect(next.map.explored[5]![7]).toBe(true);
    expect(next.map.visible).not.toBe(state.map.visible);
  });

  it('resets visible cells on FOG_UPDATED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());

    // Открываем несколько клеток.
    const opened: DisplayPatch = {
      type: 'FOG_UPDATED',
      visible: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
      explored: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
    };
    const withVisibility = applyPatch(state, opened);
    expect(withVisibility.map.visible[5]![6]).toBe(true);
    expect(withVisibility.map.visible[5]![7]).toBe(true);

    // Следующий FOV-пересчёт видит только одну из них — вторая должна сброситься.
    const reset: DisplayPatch = {
      type: 'FOG_UPDATED',
      visible: [{ x: 6, y: 5 }],
      explored: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
    };
    const next = applyPatch(withVisibility, reset);

    expect(next.map.visible[5]![6]).toBe(true);
    expect(next.map.explored[5]![7]).toBe(true);
    expect(next.map.visible[5]![7]).toBe(false);
  });

  it('updates door open state', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({ type: 'DOOR_OPENED', position: { x: 4, y: 5 } }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.entities.get('door_1')!.isOpen).toBe(true);
    expect(state.entities.get('door_1')!.isOpen).toBe(false);
  });

  it('adds a floor item container on ITEM_DROPPED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({
      type: 'ITEM_DROPPED',
      dropperEntityId: 'enemy_test_1',
      itemInstanceId: 'item_2',
      containerId: 'floor_container_2',
      templateId: 'gold',
      position: { x: 7, y: 5 },
      from: { x: 6, y: 5 },
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    const container = next.entities.get('floor_container_2');
    expect(container).toBeDefined();
    expect(container!.type).toBe('floor_item_container');
    expect(container!.x).toBe(7);
    expect(container!.y).toBe(5);
  });

  it('removes dead entities on DEAD_ENTITIES_CLEANED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({
      type: 'DEAD_ENTITIES_CLEANED',
      removed: [{ entityId: 'door_1', position: { x: 4, y: 5 } }],
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.entities.has('door_1')).toBe(false);
    expect(state.entities.has('door_1')).toBe(true);
  });

  it('updates player death and phase', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({ type: 'PLAYER_DIED' }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.player.isAlive).toBe(false);
    expect(next.meta.phase).toBe('dead');
    expect(state.player.isAlive).toBe(true);
  });

  it('updates player level on PLAYER_LEVELED_UP', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({ type: 'PLAYER_LEVELED_UP', newLevel: 2 }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.player.level).toBe(2);
  });

  it('updates meta on TURN_BEGAN', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch = createPatch({
      type: 'TURN_BEGAN',
      side: 'enemies',
      round: 1,
      actorId: 'enemy_test_1',
    }, makeMinimalState());
    const next = applyPatch(state, patch);

    expect(next.meta.turnSide).toBe('enemies');
    expect(next.meta.round).toBe(1);
  });

  it('updates tileEffects on TILE_EFFECT_CHANGED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const patch: DisplayPatch = {
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [
        { type: 'oil', renderOrder: 1 },
        { type: 'burning', renderOrder: 2 },
      ],
    };
    const next = applyPatch(state, patch);

    expect(next.map.tiles[3]![3]!.tileEffects).toEqual([
      { type: 'oil', renderOrder: 1 },
      { type: 'burning', renderOrder: 2 },
    ]);
    expect(state.map.tiles[3]![3]!.tileEffects).toBeUndefined();
  });

  it('updates tileEffects on TILE_EFFECT_REMOVED', () => {
    const state = buildDisplayState(buildStateWithDoorAndItem());
    const changed: DisplayPatch = {
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [
        { type: 'oil', renderOrder: 1 },
        { type: 'burning', renderOrder: 2 },
      ],
    };
    const withEffects = applyPatch(state, changed);

    const removed: DisplayPatch = {
      type: 'TILE_EFFECT_REMOVED',
      effectType: 'oil',
      position: { x: 3, y: 3 },
      overlays: [],
    };
    const next = applyPatch(withEffects, removed);

    expect(next.map.tiles[3]![3]!.tileEffects).toEqual([]);
  });
});

describe('resyncDisplayState', () => {
  it('synchronizes with the final GameState', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
      floor: 2,
      phase: 'victory',
      turn: { activeSide: 'enemies', round: 3 },
    });

    const display = buildDisplayState(state);
    expect(display.player.x).toBe(5);
    expect(display.meta.floor).toBe(2);

    // Мутируем GameState, как это делает Simulation.
    player.x = 7;
    player.y = 5;
    enemy.hp = 5;
    state.phase = 'playing';

    const synced = resyncDisplayState(state);
    expect(synced.player.x).toBe(7);
    expect(synced.entities.get(enemy.id)!.hp).toBe(5);
    expect(synced.meta.phase).toBe('playing');
  });
});
