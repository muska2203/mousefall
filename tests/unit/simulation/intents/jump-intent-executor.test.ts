import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeJumpIntent } from '../../../../src/simulation/systems/intents/jump-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';

describe('executeJumpIntent', () => {
  it('moves entity and emits ENTITY_MOVED with movementType jump', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'swoop', targets: [{ x: 7, y: 5 }] },
    });

    const node = executeJumpIntent(
      state,
      { type: 'JUMP', entityId: player.id, dx: 2, dy: 0 },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    expect(node?.event).toMatchObject({
      type: 'ENTITY_MOVED',
      entityId: player.id,
      from: { x: 5, y: 5 },
      to: { x: 7, y: 5 },
      movementType: 'jump',
    });
  });

  it('does not move entity into blocked tile', () => {
    const state = makeGameState();
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'swoop', targets: [{ x: 7, y: 5 }] },
    });

    const node = executeJumpIntent(
      state,
      { type: 'JUMP', entityId: player.id, dx: 2, dy: 0 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });
});
