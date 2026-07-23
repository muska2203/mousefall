/**
 * Unit-тесты исполнителя TILE_EXPLOSION.
 */

import { describe, it, expect } from 'vitest';
import { makeGameState } from '../../../fixtures/gameState';
import { executeTileExplosionIntent } from '../../../../src/simulation/systems/intents/tile-explosion-intent-executor';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';

function makeBuilder() {
  return new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: null });
}

describe('executeTileExplosionIntent', () => {
  it('эмитит TILE_EXPLODED для позиции в пределах карты', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeTileExplosionIntent(
      state,
      {
        type: 'TILE_EXPLOSION',
        position: { x: 3, y: 3 },
        sourceEntityId: null,
        damage: 2,
        radius: 1,
        tags: ['damage.magical.fire'],
      },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'TILE_EXPLODED',
      position: { x: 3, y: 3 },
      sourceEntityId: null,
      damage: 2,
      radius: 1,
      tags: ['damage.magical.fire'],
    });
  });

  it('возвращает null для позиции вне карты', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeTileExplosionIntent(
      state,
      {
        type: 'TILE_EXPLOSION',
        position: { x: 100, y: 100 },
        sourceEntityId: null,
        damage: 2,
        radius: 1,
        tags: ['damage.magical.fire'],
      },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('сохраняет sourceEntityId в событии', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeTileExplosionIntent(
      state,
      {
        type: 'TILE_EXPLOSION',
        position: { x: 3, y: 3 },
        sourceEntityId: 'player_1',
        damage: 5,
        radius: 2,
        tags: ['damage.magical.ice'],
      },
      builder,
      builder.root,
    );

    expect(node!.event).toMatchObject({
      type: 'TILE_EXPLODED',
      sourceEntityId: 'player_1',
      damage: 5,
      radius: 2,
      tags: ['damage.magical.ice'],
    });
  });
});
