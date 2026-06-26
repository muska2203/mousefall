import { describe, expect, it } from 'vitest';
import { makeGameState } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeTriggerStairExitIntent } from '../../../../src/simulation/systems/intents/trigger-stair-exit-intent-executor';

describe('executeTriggerStairExitIntent', () => {
  it('emits STAIR_EXIT_TRIGGERED as a child node with direction down', () => {
    const state = makeGameState();
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'player', dx: 0, dy: 0 },
    });

    const node = executeTriggerStairExitIntent(
      state,
      { type: 'TRIGGER_STAIR_EXIT', direction: 'down' },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(node?.event).toMatchObject({
      type: 'STAIR_EXIT_TRIGGERED',
      direction: 'down',
    });
    expect(builder.root.children).toContain(node);
  });

  it('emits STAIR_EXIT_TRIGGERED with direction up', () => {
    const state = makeGameState();
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'player', dx: 0, dy: 0 },
    });

    const node = executeTriggerStairExitIntent(
      state,
      { type: 'TRIGGER_STAIR_EXIT', direction: 'up' },
      builder,
      builder.root,
    );

    expect(node?.event).toMatchObject({
      type: 'STAIR_EXIT_TRIGGERED',
      direction: 'up',
    });
  });
});
