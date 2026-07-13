/**
 * Проверка ограничения глубины цепочки реакций контентных правил.
 *
 * Файл не мокает utils/rng — здесь важен только механизм отсечки циклов.
 */

import { describe, it, expect, vi } from 'vitest';
import { ExecutionBuilder } from '@simulation/core-types.ts';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import type { ActiveRule } from '@simulation/content-rules/types.ts';
import { makePlayer, makeEnemy, makeStateWithPlayerAndEntity } from '../../../fixtures/gameState';

describe('лимит глубины цепочки реакций', () => {
  it('прерывает бесконечную реакцию после 1000 шагов и не зависает', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 10000, armor: 0 });
    const state = makeStateWithPlayerAndEntity(player, enemy);
    state.featureFlags.contentRulesEnabled = true;

    const loopRule: ActiveRule = {
      id: 'test_infinite_loop',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: {
        type: 'dealDamage',
        amount: 0,
        tags: ['damage.magical.fire'],
      },
      target: { type: 'eventTarget' },
      priority: 0,
      ownerContext: { type: 'entity', entityId: 'loop_item' },
    };
    player.activeRules.push(loopRule);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
    });

    executeIntent(
      state,
      {
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 0,
        tags: ['damage.magical.fire'],
      },
      builder,
      builder.root,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('превышен лимит глубины реакций'),
      1000,
    );

    errorSpy.mockRestore();
  });
});
