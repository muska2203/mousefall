import { describe, expect, it } from 'vitest';
import { createTestSimulation } from '../../helpers/simulation';
import { makeGameState, makePlayer } from '../../fixtures/gameState';

describe('GameSimulation.dispatch — ACTION_REJECTED', () => {
  it('returns ACTION_REJECTED when moving into a wall', () => {
    const player = makePlayer({ x: 1, y: 1, ap: 1, maxAp: 1 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 });

    expect(result.success).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(sim.getState().player.ap).toBe(1); // AP не списались

    const actionNode = result.phases[0]!.actions[0]!;
    expect(actionNode.event.type).toBe('ACTION_APPLIED');
    expect(actionNode.children).toHaveLength(1);
    expect(actionNode.children[0]!.event.type).toBe('ACTION_REJECTED');
    const rejected = actionNode.children[0]!.event as { type: 'ACTION_REJECTED'; errors: { code: string; description: string }[] };
    expect(rejected.errors[0]!.code).toBe('tile_blocked');
  });

  it('returns ACTION_REJECTED when actor cannot act (no AP)', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 0, maxAp: 1 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(false);
    expect(result.stateChanged).toBe(false);

    const actionNode = result.phases[0]!.actions[0]!;
    expect(actionNode.children).toHaveLength(1);
    expect(actionNode.children[0]!.event.type).toBe('ACTION_REJECTED');
    const rejected = actionNode.children[0]!.event as { type: 'ACTION_REJECTED'; errors: { code: string; description: string }[] };
    expect(rejected.errors[0]!.code).toBe('actor_cannot_act');
  });

  it('succeeds and spends AP on valid move', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(sim.getState().player.ap).toBe(1);

    const actionNode = result.phases[0]!.actions[0]!;
    expect(actionNode.event.type).toBe('ACTION_APPLIED');
    const movedNode = actionNode.children.find(c => c.event.type === 'ENTITY_MOVED');
    expect(movedNode).toBeDefined();
  });
});
