import { describe, expect, it } from 'vitest';
import { makeGameState } from '../../../fixtures/gameState';
import { executeBeginTurnIntent } from '../../../../src/simulation/systems/intents/begin-turn-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';

describe('executeBeginTurnIntent', () => {
  it('устанавливает activeSide и увеличивает round при ходе игрока', () => {
    const state = makeGameState({ turn: { activeSide: 'enemies', round: 3 } });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 4, actorId: null });
    const node = executeBeginTurnIntent(state, { type: 'BEGIN_TURN', side: 'player' }, builder, builder.root);

    expect(state.turn.activeSide).toBe('player');
    expect(state.turn.round).toBe(4);
    expect(node!.event).toMatchObject({
      type: 'TURN_BEGAN',
      side: 'player',
      round: 4,
      actorId: null,
    });
  });

  it('устанавливает activeSide, но не меняет round при ходе окружения', () => {
    const state = makeGameState({ turn: { activeSide: 'player', round: 3 } });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'enemies', round: 3, actorId: null });
    executeBeginTurnIntent(state, { type: 'BEGIN_TURN', side: 'enemies' }, builder, builder.root);

    expect(state.turn.activeSide).toBe('enemies');
    expect(state.turn.round).toBe(3);
  });
});
