/**
 * Интеграционные тесты новых правил поджога масла.
 *
 * 1. Свежее масло, появившееся в радиусе 1 от горящего масла, сразу поджигается.
 * 2. При появлении статуса горения на масле сущности на клетке получают урон
 *    и статус горения (аналогично входу на горящую клетку).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {executeIntent} from '../../../src/simulation/systems/intents/execute-intent';
import {makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {loadTestContent, setupCombatScenario} from '../combat-scenarios/helpers';
import type {GameState} from '../../../src/simulation/types';

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
  return state.tileEffects[y]?.[x]?.['cover'];
}

describe('Правила поджога масла', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  afterEach(() => {
    // Реестр контента сбрасывается внутри loadTestContent через resetRegistry().
  });

  it('свежее масло поджигается, если появилось рядом с горящим', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // Спавним и подожжём масло в (2,2).
    expect(simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 2, y: 2 },
    }).success).toBe(true);

    const igniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
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

    expect(getOilAt(state, 2, 2)?.statusEffects.some((s) => s.type === 'burning')).toBe(true);

    // Спавним свежее масло в соседней клетке — оно должно поджечься автоматически.
    expect(simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 3, y: 2 },
    }).success).toBe(true);

    expect(getOilAt(state, 3, 2)?.statusEffects.some((s) => s.type === 'burning')).toBe(true);
  });

  it('поджог масла наносит урон и горение сущности на клетке', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    player.x = 2;
    player.y = 2;
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    expect(simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 2, y: 2 },
    }).success).toBe(true);

    const hpBefore = player.hp;

    const igniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
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

    expect(getOilAt(state, 2, 2)?.statusEffects.some((s) => s.type === 'burning')).toBe(true);
    // Игрок стоит на клетке с маслом, поэтому получает:
    // 1 от DAMAGE_TILE + 3 от burning_tile_status_applied_deals_damage + 2 от взрыва масла.
    expect(player.hp).toBe(hpBefore - 6);
    // Правило burning_tile_status_applied_applies_burning накладывает статус горения.
    expect(player.statusEffects.some((s) => s.type === 'burning')).toBe(true);
  });
});
