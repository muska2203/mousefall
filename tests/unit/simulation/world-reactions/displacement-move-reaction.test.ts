import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
import type { GameEvent } from '../../../../src/simulation/core-types';

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

describe('displacementMoveReaction', () => {
  it('перемещает игрока на лестницу при толчке, но не вызывает автоматический переход этажа', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 4 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set('stairs_down_1', {
      type: 'stairs',
      id: 'stairs_down_1',
      templateId: 'stairs_down',
      x: 5,
      y: 3,
      blocksMovement: false,
      interactionKind: 'stairs',
    } as any);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'push', targets: [] },
    });

    executeIntent(
      state,
      { type: 'PUSH', entityId: player.id, dx: 0, dy: -1, sourceEntityId: null },
      builder,
      builder.root,
    );

    const events = collectEvents(builder.root) as GameEvent[];

    expect(player.x).toBe(5);
    expect(player.y).toBe(3);

    expect(events.some((e: any) => e.type === 'STAIR_EXIT_TRIGGERED')).toBe(false);
    expect(events.some(e => e.type === 'ENTITY_MOVED')).toBe(true);
  });
});
