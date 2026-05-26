/**
 * Unit tests for fogFilter.
 */

import { describe, expect, it } from 'vitest';
import { filterByFOV, isEventVisible } from '../../../src/presentation/fogFilter';
import type { ExecutionNode, GameEvent } from '../../../src/simulation/core-types';
import type { GameState } from '../../../src/simulation/types';

function makeState(opts: { width?: number; height?: number; visible?: boolean[][] } = {}): GameState {
  const width = opts.width ?? 5;
  const height = opts.height ?? 5;
  return {
    map: { width, height, tiles: [], rooms: [] },
    visible: opts.visible ?? Array.from({ length: height }, () => Array(width).fill(false)),
    explored: Array.from({ length: height }, () => Array(width).fill(false)),
    entities: new Map(),
    player: { id: 'player', x: 2, y: 2 } as any,
  } as unknown as GameState;
}

function makeNode(event: GameEvent, children: ExecutionNode[] = []): ExecutionNode {
  return { event, parent: null, children };
}

function makeResult(actions: ExecutionNode[]) {
  return { success: true, stateChanged: true, phases: [{ side: 'PLAYER' as const, actions }] };
}

describe('isEventVisible', () => {
  it('ENTITY_MOVED: visible if from OR to is visible', () => {
    const state = makeState({
      visible: [
        [false, false, false],
        [false, false, false],
        [false, false, true],
      ],
    });

    const visibleMove = { type: 'ENTITY_MOVED' as const, entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 2, y: 2 } };
    expect(isEventVisible(visibleMove, state)).toBe(true);

    const hiddenMove = { type: 'ENTITY_MOVED' as const, entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
    expect(isEventVisible(hiddenMove, state)).toBe(false);
  });

  it('ENTITY_DAMAGED: visible if position is visible', () => {
    const state = makeState({
      visible: [
        [false, false],
        [false, true],
      ],
    });

    expect(isEventVisible({ type: 'ENTITY_DAMAGED', targetId: 'e1', damage: 5, position: { x: 1, y: 1 } }, state)).toBe(true);
    expect(isEventVisible({ type: 'ENTITY_DAMAGED', targetId: 'e1', damage: 5, position: { x: 0, y: 0 } }, state)).toBe(false);
  });

  it('ABILITY_USED: visible if from OR any target is visible', () => {
    const state = makeState({
      visible: [
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
    });

    const visibleCaster = { type: 'ABILITY_USED' as const, entityId: 'e1', abilityId: 'fireball', targets: [{ x: 0, y: 0 }], from: { x: 1, y: 1 } };
    expect(isEventVisible(visibleCaster, state)).toBe(true);

    const visibleTarget = { type: 'ABILITY_USED' as const, entityId: 'e1', abilityId: 'fireball', targets: [{ x: 1, y: 1 }], from: { x: 0, y: 0 } };
    expect(isEventVisible(visibleTarget, state)).toBe(true);

    const hidden = { type: 'ABILITY_USED' as const, entityId: 'e1', abilityId: 'fireball', targets: [{ x: 0, y: 0 }], from: { x: 2, y: 2 } };
    expect(isEventVisible(hidden, state)).toBe(false);
  });

  it('ACTION_APPLIED (ATTACK): visible if actor or target cell is visible', () => {
    const state = makeState({
      visible: [
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
    });
    state.entities.set('player', { id: 'player', x: 1, y: 1 } as any);

    const visibleActor = { type: 'ACTION_APPLIED' as const, action: { type: 'ATTACK' as const, entityId: 'player', dx: 1, dy: 0 } };
    expect(isEventVisible(visibleActor, state)).toBe(true);

    const visibleTarget = { type: 'ACTION_APPLIED' as const, action: { type: 'ATTACK' as const, entityId: 'player', dx: 0, dy: -1 } };
    expect(isEventVisible(visibleTarget, state)).toBe(true);

    state.entities.set('player', { id: 'player', x: 0, y: 0 } as any);
    const hidden = { type: 'ACTION_APPLIED' as const, action: { type: 'ATTACK' as const, entityId: 'player', dx: 1, dy: 0 } };
    expect(isEventVisible(hidden, state)).toBe(false);
  });

  it('FOG_UPDATED: always visible', () => {
    const state = makeState();
    expect(isEventVisible({ type: 'FOG_UPDATED', newlyVisible: [] }, state)).toBe(true);
  });

  it('PLAYER_DIED: always visible', () => {
    const state = makeState();
    expect(isEventVisible({ type: 'PLAYER_DIED' }, state)).toBe(true);
  });
});

describe('filterByFOV', () => {
  it('removes invisible events', () => {
    const state = makeState({
      visible: [
        [false, false],
        [false, false],
      ],
    });

    const node = makeNode({ type: 'ENTITY_MOVED', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
    const result = makeResult([node]);
    const filtered = filterByFOV(result, state);

    expect(filtered.phases).toHaveLength(0);
  });

  it('keeps visible events', () => {
    const state = makeState({
      visible: [
        [true, false],
        [false, false],
      ],
    });

    const node = makeNode({ type: 'ENTITY_MOVED', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
    const result = makeResult([node]);
    const filtered = filterByFOV(result, state);

    expect(filtered.phases).toHaveLength(1);
    expect(filtered.phases[0]!.actions).toHaveLength(1);
  });

  it('lifts visible children of invisible parents', () => {
    const state = makeState({
      visible: [
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
    });

    // Невидимый родитель (from и targets в тумане), но ребёнок — урон на видимой клетке
    const child = makeNode({ type: 'ENTITY_DAMAGED', targetId: 'player', damage: 5, position: { x: 1, y: 1 } });
    const parent = makeNode({ type: 'ABILITY_USED', entityId: 'e1', abilityId: 'fireball', targets: [{ x: 0, y: 0 }], from: { x: 0, y: 0 } }, [child]);
    const result = makeResult([parent]);
    const filtered = filterByFOV(result, state);

    expect(filtered.phases).toHaveLength(1);
    expect(filtered.phases[0]!.actions).toHaveLength(1);
    // Ребёнок поднялся на уровень корня
    expect(filtered.phases[0]!.actions[0]!.event.type).toBe('ENTITY_DAMAGED');
  });

  it('filters mixed phases', () => {
    const state = makeState({
      visible: [
        [true, false],
        [false, false],
      ],
    });

    const visibleNode = makeNode({ type: 'ENTITY_MOVED', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
    const hiddenNode = makeNode({ type: 'ENTITY_MOVED', entityId: 'e2', from: { x: 1, y: 1 }, to: { x: 1, y: 0 } });
    const result = makeResult([visibleNode, hiddenNode]);
    const filtered = filterByFOV(result, state);

    expect(filtered.phases[0]!.actions).toHaveLength(1);
    expect(filtered.phases[0]!.actions[0]!.event.type).toBe('ENTITY_MOVED');
    expect((filtered.phases[0]!.actions[0]!.event as any).entityId).toBe('e1');
  });
});
