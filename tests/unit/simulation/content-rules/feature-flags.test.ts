/**
 * Тесты feature flag контентных правил.
 */

import { describe, it, expect } from 'vitest';
import { ExecutionBuilder } from '@simulation/core-types.ts';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import { GameSimulation } from '@simulation/simulation.ts';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
  makeGameState,
} from '../../../fixtures/gameState';

describe('content-rules feature flags', () => {
  it('makeGameState создаёт состояние с включённой системой контентных правил', () => {
    const state = makeGameState();
    expect(state.featureFlags.contentRulesEnabled).toBe(true);
  });

  it('executeIntent работает корректно с включённой системой контентных правил', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 20, armor: 0 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

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
        damage: 10,
        tags: ['damage.physical.slashing'],
      },
      builder,
      builder.root,
    );

    expect(enemy.hp).toBe(10);
  });

  it('флаг включен без подходящих правил: поведение не меняется', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({ x: 7, y: 5 }));

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: player.id, dx: 1, dy: 0 },
    });

    executeIntent(
      state,
      { type: 'MOVE', entityId: player.id, dx: 1, dy: 0 },
      builder,
      builder.root,
    );

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
  });

  it('включение/выключение через GameSimulation.setContentRulesEnabled', () => {
    const state = makeStateWithPlayerAndEntity(makePlayer(), makeEnemy());
    const simulation = GameSimulation.loadSavedGame(state, false);

    expect(simulation.getState().featureFlags.contentRulesEnabled).toBe(true);

    simulation.setContentRulesEnabled(false);
    expect(simulation.getState().featureFlags.contentRulesEnabled).toBe(false);

    simulation.setContentRulesEnabled(true);
    expect(simulation.getState().featureFlags.contentRulesEnabled).toBe(true);
  });
});
