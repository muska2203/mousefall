/**
 * Интеграционные тесты горящего тайлового эффекта.
 *
 * Проверяет:
 * 1. Урон и наложение статуса `burning` при входе актора на горящее масло.
 * 2. Распространение горения на соседние клетки с маслом при тике.
 * 3. Отсутствие распространения на воду и пустые тайлы.
 * 4. Тушение горящего масла водой (замена эффекта и удаление статуса).
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

function getWaterAt(state: GameState, x: number, y: number) {
  return state.tileEffects[y]?.[x]?.['water'];
}

function spawnOil(simulation: GameSimulation, playerId: string, x: number, y: number) {
  const result = simulation.dispatch({
    type: 'DEBUG_SPAWN_TILE_EFFECT',
    entityId: playerId,
    effectType: 'oil',
    position: { x, y },
  });
  expect(result.success).toBe(true);
}

function spawnWater(simulation: GameSimulation, playerId: string, x: number, y: number) {
  const result = simulation.dispatch({
    type: 'DEBUG_SPAWN_TILE_EFFECT',
    entityId: playerId,
    effectType: 'water',
    position: { x, y },
  });
  expect(result.success).toBe(true);
}

function applyBurningToOil(state: GameState, x: number, y: number) {
  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'END_TURN', entityId: state.player.id },
  });
  executeIntent(
    state,
    {
      type: 'APPLY_TILE_EFFECT_STATUS',
      effectType: 'oil',
      statusType: 'burning',
      position: { x, y },
      duration: 3,
    },
    builder,
    builder.root,
  );
}

describe('Горящий тайловый эффект', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  afterEach(() => {
    // Реестр контента сбрасывается внутри loadTestContent через resetRegistry().
  });

  it('при входе на горящее масло актор получает урон и статус burning', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    spawnOil(simulation, player.id, 2, 2);
    applyBurningToOil(state, 2, 2);

    const hpBefore = player.hp;

    const moveResult = simulation.dispatch({
      type: 'MOVE',
      entityId: player.id,
      dx: 0,
      dy: 1,
    });
    expect(moveResult.success).toBe(true);
    expect(player.x).toBe(2);
    expect(player.y).toBe(2);

    expect(player.hp).toBe(hpBefore - 3);
    expect(player.statusEffects.some((effect) => effect.type === 'burning')).toBe(true);
  });

  it('при тике burning распространяется на соседние клетки с маслом', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    spawnOil(simulation, player.id, 2, 2);
    spawnOil(simulation, player.id, 3, 2);
    applyBurningToOil(state, 2, 2);

    expect(getOilAt(state, 3, 2)!.statusEffects).toHaveLength(0);

    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const neighborOil = getOilAt(state, 3, 2);
    expect(neighborOil).toBeDefined();
    expect(neighborOil!.statusEffects.some((s) => s.type === 'burning')).toBe(true);
  });

  it('при тике burning не распространяется на воду и пустые тайлы', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    spawnOil(simulation, player.id, 2, 2);
    spawnWater(simulation, player.id, 3, 2);
    // Клетка (4, 2) остаётся пустой.
    applyBurningToOil(state, 2, 2);

    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const waterTile = getWaterAt(state, 3, 2);
    expect(waterTile).toBeDefined();
    expect(waterTile!.statusEffects.some((s) => s.type === 'burning')).toBe(false);

    expect(getOilAt(state, 3, 2)).toBeUndefined();
    expect(getOilAt(state, 4, 2)).toBeUndefined();
    expect(getWaterAt(state, 4, 2)).toBeUndefined();
  });

  it('вода, наложенная на горящее масло, заменяет oil и удаляет burning', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    spawnOil(simulation, player.id, 2, 2);
    applyBurningToOil(state, 2, 2);

    const oilBefore = getOilAt(state, 2, 2);
    expect(oilBefore).toBeDefined();
    expect(oilBefore!.statusEffects.some((s) => s.type === 'burning')).toBe(true);

    spawnWater(simulation, player.id, 2, 2);

    expect(getOilAt(state, 2, 2)).toBeUndefined();

    const waterAfter = getWaterAt(state, 2, 2);
    expect(waterAfter).toBeDefined();
    expect(waterAfter!.statusEffects.some((s) => s.type === 'burning')).toBe(false);
  });
});
