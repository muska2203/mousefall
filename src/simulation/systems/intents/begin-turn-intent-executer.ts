import { GameState } from '@simulation/types';
import { BeginTurnIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';

/**
 * Фиксирует начало хода стороны.
 *
 * Контракт:
 * - Устанавливает state.turn.activeSide.
 * - При side === 'player' увеличивает state.turn.round на 1.
 * - Порождает событие TURN_BEGAN.
 */
export const executeBeginTurnIntent: IntentExecutor<BeginTurnIntent> = (
  state: GameState,
  intent: BeginTurnIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  state.turn.activeSide = intent.side;

  if (intent.round !== undefined) {
    state.turn.round = intent.round;
  } else if (intent.side === 'player') {
    state.turn.round += 1;
  }

  return builder.addChild(parent, {
    type: 'TURN_BEGAN',
    side: intent.side,
    round: state.turn.round,
    actorId: null,
  });
};
