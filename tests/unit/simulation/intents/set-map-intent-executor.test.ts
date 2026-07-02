import { describe, expect, it } from 'vitest';
import { makeGameState, makeTestMap } from '../../../fixtures/gameState.ts';
import { executeSetMapIntent } from '@simulation/systems/intents/set-map-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';

describe('executeSetMapIntent', () => {
  it('устанавливает карту, пересоздаёт visible и explored', () => {
    const state = makeGameState();
    const newMap = makeTestMap(12, 8);
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'WAIT', entityId: 'player' },
    });

    const node = executeSetMapIntent(
      state,
      { type: 'SET_MAP', map: newMap },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('MAP_CHANGED');
    const event = node!.event as import('@simulation/core-types').MapChangedEvent;
    expect(event.width).toBe(12);
    expect(event.height).toBe(8);

    expect(state.map).toBe(newMap);
    expect(state.visible.length).toBe(8);
    expect(state.visible[0]!.length).toBe(12);
    expect(state.explored.length).toBe(8);
    expect(state.explored[0]!.length).toBe(12);
    expect(state.explored.every(row => row.every(cell => cell === false))).toBe(true);
  });

  it('использует переданную сетку explored', () => {
    const state = makeGameState();
    const newMap = makeTestMap(6, 6);
    const explored = Array.from({ length: 6 }, () => Array(6).fill(false) as boolean[]);
    explored[2]![2] = true;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'WAIT', entityId: 'player' },
    });

    executeSetMapIntent(
      state,
      { type: 'SET_MAP', map: newMap, explored },
      builder,
      builder.root,
    );

    expect(state.explored[2]![2]).toBe(true);
    expect(state.explored[0]![0]).toBe(false);
  });
});
