import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeRestoreApIntent } from '../../../../src/simulation/systems/intents/restore-ap-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';

describe('executeRestoreApIntent', () => {
  it('восстанавливает AP актора до максимума и порождает AP_RESTORED', () => {
    const player = makePlayer({ ap: 0, maxAp: 3 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: player.id });
    const node = executeRestoreApIntent(state, { type: 'RESTORE_AP', entityId: player.id }, builder, builder.root);

    expect(state.player.ap).toBe(3);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'AP_RESTORED',
      entityId: player.id,
      amount: 3,
      remaining: 3,
    });
  });

  it('не меняет AP, если он уже на максимуме', () => {
    const player = makePlayer({ ap: 2, maxAp: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: player.id });
    executeRestoreApIntent(state, { type: 'RESTORE_AP', entityId: player.id }, builder, builder.root);

    expect(state.player.ap).toBe(2);
  });

  it('возвращает null для несуществующей сущности', () => {
    const state = makeGameState();
    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: 'missing' });
    const node = executeRestoreApIntent(state, { type: 'RESTORE_AP', entityId: 'missing' }, builder, builder.root);

    expect(node).toBeNull();
  });
});
