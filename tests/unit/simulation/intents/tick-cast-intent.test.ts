import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeTickCastIntent } from '../../../../src/simulation/systems/intents/tick-cast-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';

describe('executeTickCastIntent', () => {
  it('уменьшает remainingTurns каста на 1 и порождает CAST_TICKED', () => {
    const player = makePlayer({
      activeCast: { abilityId: 'fireball', fixedTargets: [{ x: 6, y: 5 }], remainingTurns: 2 },
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 1, actorId: player.id });
    const node = executeTickCastIntent(state, { type: 'TICK_CAST', entityId: player.id }, builder, builder.root);

    expect(state.player.activeCast!.remainingTurns).toBe(1);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'CAST_TICKED',
      entityId: player.id,
      abilityId: 'fireball',
      remainingTurns: 1,
    });
  });

  it('не опускает remainingTurns ниже 0', () => {
    const player = makePlayer({
      activeCast: { abilityId: 'fireball', fixedTargets: [{ x: 6, y: 5 }], remainingTurns: 0 },
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 1, actorId: player.id });
    executeTickCastIntent(state, { type: 'TICK_CAST', entityId: player.id }, builder, builder.root);

    expect(state.player.activeCast!.remainingTurns).toBe(0);
  });

  it('возвращает null, если у актора нет активного каста', () => {
    const player = makePlayer({ activeCast: null });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 1, actorId: player.id });
    const node = executeTickCastIntent(state, { type: 'TICK_CAST', entityId: player.id }, builder, builder.root);

    expect(node).toBeNull();
  });
});
