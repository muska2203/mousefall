/**
 * Интеграционный тест взрыва горящего масла.
 *
 * Проверяет, что при наложении burning на oil происходит взрыв радиуса 1,
 * наносящий урон по клеткам и поджигающий соседнее масло (цепная реакция).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { executeIntent } from '../../../src/simulation/systems/intents/execute-intent';
import { makeGameState, makePlayer, makeTestMap } from '../../fixtures/gameState';
import { loadTestContent, setupCombatScenario } from '../combat-scenarios/helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import type { GameState } from '../../../src/simulation/types';

function createTestPlayer() {
  return makePlayer({
    x: 2,
    y: 1,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
  });
}

function getOilAt(state: GameState, x: number, y: number) {
  return state.tileEffects[y]?.[x]?.['oil'];
}

describe('Взрыв горящего масла', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  afterEach(() => {
    // Реестр контента сбрасывается внутри loadTestContent через resetRegistry().
  });

  it('поджог центральной клетки с маслом вызывает взрыв и цепную реакцию на соседях', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // Расставляем масло вокруг центра (2,2) в радиусе 1.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const spawnResult = simulation.dispatch({
          type: 'DEBUG_SPAWN_TILE_EFFECT',
          entityId: player.id,
          effectType: 'oil',
          position: { x: 2 + dx, y: 2 + dy },
        });
        expect(spawnResult.success).toBe(true);
      }
    }

    // Поджигаем центральную клетку огненным уроном по клетке.
    const igniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE_TILE',
        position: { x: 2, y: 2 },
        sourceEntityId: null,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      igniteBuilder,
      igniteBuilder.root,
    );

    // Все клетки с маслом должны быть подожжены.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const oil = getOilAt(state, 2 + dx, 2 + dy);
        expect(oil, `масло на (${2 + dx}, ${2 + dy}) должно остаться`).toBeDefined();
        expect(
          oil!.statusEffects.some((s) => s.type === 'burning'),
          `масло на (${2 + dx}, ${2 + dy}) должно гореть`,
        ).toBe(true);
      }
    }

    // Игрок стоял на (2,1), в радиусе взрыва — получил урон.
    expect(player.hp).toBeLessThan(100);
  });

  it('взрыв не происходит при обновлении длительности горения', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 2, y: 2 },
    });

    // Первый поджог — взрыв.
    const firstIgniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE_TILE',
        position: { x: 2, y: 2 },
        sourceEntityId: null,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      firstIgniteBuilder,
      firstIgniteBuilder.root,
    );

    const hpAfterFirstExplosion = player.hp;

    // Повторный огненный урон по той же клетке — горение уже есть,
    // поэтому повторного взрыва не должно произойти.
    const secondIgniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE_TILE',
        position: { x: 2, y: 2 },
        sourceEntityId: null,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      secondIgniteBuilder,
      secondIgniteBuilder.root,
    );

    expect(player.hp).toBe(hpAfterFirstExplosion);
  });
});
