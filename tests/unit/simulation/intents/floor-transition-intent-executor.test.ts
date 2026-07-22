/**
 * Тесты исполнителя интента FLOOR_TRANSITION.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ExecutionBuilder } from '@simulation/systems/actions/types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import type { StairsEntity } from '@simulation/types';
import type { DoorTemplate } from '@content/schemas';
import { initRegistry, resetRegistry } from '@content/registry';

function childEventTypes(node: { children: { event: { type: string } }[] }): string[] {
  return node.children.map(child => child.event.type);
}

describe('executeFloorTransitionIntent', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate],
      ]),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('переходит на новый этаж и строит дерево событий', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const oldMap = state.map;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'down' },
      builder,
      builder.root,
    );

    expect(state.floor).toBe(2);
    expect(state.map).not.toBe(oldMap);
    expect(state.entities.has('player')).toBe(true);
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.turn.activeSide).toBe('player');
    expect(state.turn.round).toBe(1);

    const floorNode = builder.root.children[0]!;
    expect(floorNode.event.type).toBe('FLOOR_CHANGED');

    const types = childEventTypes(floorNode);
    expect(types).toContain('MAP_CHANGED');
    expect(types).toContain('ENTITIES_REPLACED');
    expect(types).toContain('ENTITY_MOVED');
    expect(types).toContain('TURN_BEGAN');
    expect(types).toContain('AP_RESTORED');
  });

  it('сохраняет текущий этаж в снапшот перед спуском', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    state.explored[5]![5] = true;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'down' },
      builder,
      builder.root,
    );

    expect(state.floorSnapshots[0]).toBeDefined();
    expect(state.floorSnapshots[0]!.floor).toBe(1);
    expect(state.floorSnapshots[0]!.explored[5]![5]).toBe(true);
  });

  it('позиционирует игрока у противоположной лестницы при переходе', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'down' },
      builder,
      builder.root,
    );

    const stairsUp = Array.from(state.entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_up',
    );
    expect(stairsUp).toBeDefined();
    expect(state.player.x).toBe(stairsUp!.x);
    expect(state.player.y).toBe(stairsUp!.y);
  });

  it('не теряет игрока при переходе', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 77 });
    const state = makeGameState({ player, floor: 1 });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'down' },
      builder,
      builder.root,
    );

    expect(state.player.hp).toBe(77);
    expect(state.entities.get('player')).toBe(state.player);
  });

  it('поднимается на предыдущий этаж и восстанавливает его из снапшота', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const floor1Map = state.map;

    const downBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'down' },
      downBuilder,
      downBuilder.root,
    );

    expect(state.floor).toBe(2);
    expect(state.map).not.toBe(floor1Map);

    const upBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'FLOOR_TRANSITION', entityId: 'player', direction: 'up' },
      upBuilder,
      upBuilder.root,
    );

    expect(state.floor).toBe(1);
    expect(state.map).toBe(floor1Map);
  });
});
