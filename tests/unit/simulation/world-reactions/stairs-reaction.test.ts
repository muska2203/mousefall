import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeStairs } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
import { stairsTransitionReaction } from '../../../../src/simulation/systems/world-reactions/stairs-reaction';
import { MAX_FLOOR } from '../../../../src/utils/constants';

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'MOVE', entityId, dx: 0, dy: 0 },
  });
}

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

describe('stairsTransitionReaction', () => {
  it('returns TRIGGER_STAIR_EXIT intent when player moves onto stairs_down', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder(player.id);
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: player.id, from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([{ type: 'TRIGGER_STAIR_EXIT', direction: 'down' }]);
  });

  it('returns TRIGGER_STAIR_EXIT intent with direction up for stairs_up', () => {
    const state = makeGameState({ floor: 2 });
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_up', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder(player.id);
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: player.id, from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([{ type: 'TRIGGER_STAIR_EXIT', direction: 'up' }]);
  });

  it('returns empty array when there is no stairs at destination', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = makeBuilder(player.id);
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: player.id, from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([]);
  });

  it('returns empty array for non-player entity', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder('enemy_1');
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: 'enemy_1', from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([]);
  });

  it('returns empty array when moving down on the deepest floor', () => {
    const state = makeGameState({ floor: MAX_FLOOR });
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder(player.id);
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: player.id, from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([]);
  });

  it('returns empty array when moving up on the first floor', () => {
    const state = makeGameState({ floor: 1 });
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_up', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder(player.id);
    const intents = stairsTransitionReaction(
      state,
      { type: 'ENTITY_MOVED', entityId: player.id, from: { x: 5, y: 4 }, to: { x: 5, y: 5 }, movementType: 'walk' },
      builder,
      builder.root,
    );

    expect(intents).toEqual([]);
  });

  it('integration: moving onto stairs emits STAIR_EXIT_TRIGGERED through executeIntent', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 4, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(stairs.id, stairs);

    const builder = makeBuilder(player.id);
    executeIntent(state, { type: 'MOVE', entityId: player.id, dx: 1, dy: 0 }, builder, builder.root);

    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    const events = collectEvents(builder.root);
    expect(events.some((e: any) => e.type === 'ENTITY_MOVED')).toBe(true);
    expect(events.some((e: any) => e.type === 'STAIR_EXIT_TRIGGERED' && e.direction === 'down')).toBe(true);
  });
});
