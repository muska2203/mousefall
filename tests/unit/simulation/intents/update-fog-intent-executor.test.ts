import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState.ts';
import { executeUpdateFogIntent } from '@simulation/systems/intents/update-fog-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';
import type { Entity, EntityId } from '@simulation/types';

describe('executeUpdateFogIntent', () => {
  it('добавляет FOG_UPDATED как дочерние узлы', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, entities: new Map<EntityId, Entity>([['player', player]]) });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: 'player' },
    });

    const node = executeUpdateFogIntent(
      state,
      { type: 'UPDATE_FOG' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(builder.root.children.length).toBeGreaterThan(0);
    expect(builder.root.children.every(child => child.event.type === 'FOG_UPDATED')).toBe(true);
  });
});
