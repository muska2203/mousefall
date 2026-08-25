/**
 * Тесты исполнителя интента COMPLETE_RUN (завершение забега победой, roadMap 1.5).
 */

import {describe, expect, it} from 'vitest';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import {executeIntent} from '@simulation/systems/intents/execute-intent';
import {makeGameState, makePlayer} from '../../../fixtures/gameState';

describe('executeCompleteRunIntent', () => {
  it('выставляет phase = victory и порождает событие RUN_COMPLETED без смены этажа', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const oldMap = state.map;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'INTERACT', entityId: 'player', targetId: 'stairs_1' },
    });

    executeIntent(
      state,
      { type: 'COMPLETE_RUN', entityId: 'player' },
      builder,
      builder.root,
    );

    expect(state.phase).toBe('victory');
    // Новый этаж не генерируется.
    expect(state.floor).toBe(1);
    expect(state.map).toBe(oldMap);

    const runNode = builder.root.children[0]!;
    expect(runNode.event.type).toBe('RUN_COMPLETED');
    expect(runNode.event.isFieldEvent).toBe(false);
  });
});
