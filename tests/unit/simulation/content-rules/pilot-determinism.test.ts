/**
 * Проверка детерминированности runtime RNG для пилотных контентных правил.
 *
 * Файл не мокает utils/rng — важно, чтобы реальный runtimeRng двигался
 * одинаково при одинаковых входных данных.
 */

import { describe, it, expect } from 'vitest';
import { ExecutionBuilder } from '@simulation/core-types.ts';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import { makePlayer, makeEnemy, makeStateWithPlayerAndEntity } from '../../../fixtures/gameState';

function castFireDamage(state: ReturnType<typeof makeStateWithPlayerAndEntity>): void {
  const player = state.player;
  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
  });

  executeIntent(
    state,
    {
      type: 'DAMAGE',
      entityId: 'enemy_test_1',
      sourceEntityId: player.id,
      damage: 10,
      tags: ['damage.magical.fire'],
    },
    builder,
    builder.root,
  );
}

describe('пилотные контентные правила и runtime RNG', () => {
  it('одинаковые состояния дают одинаковый результат горения', () => {
    const player1 = makePlayer({ x: 5, y: 5 });
    const enemy1 = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
    const state1 = makeStateWithPlayerAndEntity(player1, enemy1);
    state1.featureFlags.contentRulesEnabled = true;

    const player2 = makePlayer({ x: 5, y: 5 });
    const enemy2 = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
    const state2 = makeStateWithPlayerAndEntity(player2, enemy2);
    state2.featureFlags.contentRulesEnabled = true;

    expect(state1.runtimeRng.state).toBe(state2.runtimeRng.state);

    castFireDamage(state1);
    castFireDamage(state2);

    const burning1 = enemy1.statusEffects.some((e) => e.type === 'burning');
    const burning2 = enemy2.statusEffects.some((e) => e.type === 'burning');
    expect(burning1).toBe(burning2);
    expect(state1.runtimeRng.state).toBe(state2.runtimeRng.state);
  });
});
