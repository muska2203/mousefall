/**
 * Интеграционный тест цикла масла и поджога.
 *
 * Проверяет сквозной сценарий:
 * 1. Спавн масла на клетке через debug-действие.
 * 2. Перемещение игрока на масло → наложение статуса `oiled`.
 * 3. Нанесение огненного урона по сущности на масле → поджог (`burning` на tile effect).
 * 4. Тик `burning` в фазе `environment-turn` уменьшает длительность.
 * 5. После истечения длительности `burning` удаляется, а масло остаётся.
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

describe('Цикл масла и поджога', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  afterEach(() => {
    // Реестр контента сбрасывается внутри loadTestContent через resetRegistry().
  });

  it('масло не тикает и не исчезает, пока не горит', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    const spawnResult = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 2, y: 2 },
    });
    expect(spawnResult.success).toBe(true);

    const oilBefore = getOilAt(state, 2, 2);
    expect(oilBefore).toBeDefined();
    expect(oilBefore!.duration).toBe(5);

    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const oilAfterTick = getOilAt(state, 2, 2);
    expect(oilAfterTick).toBeDefined();
    expect(oilAfterTick!.duration).toBe(5);
    expect(oilAfterTick!.statusEffects).toHaveLength(0);
  });

  it('спавн масла → oiled → огненный урон → burning → тик → затухание', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // 1. Спавним масло на клетке (2,2).
    const spawnResult = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 2, y: 2 },
    });
    expect(spawnResult.success).toBe(true);

    const oilBeforeMove = getOilAt(state, 2, 2);
    expect(oilBeforeMove).toBeDefined();
    expect(oilBeforeMove!.statusEffects).toHaveLength(0);

    // 2. Перемещаем игрока на масло.
    const moveResult = simulation.dispatch({
      type: 'MOVE',
      entityId: player.id,
      dx: 0,
      dy: 1,
    });
    expect(moveResult.success).toBe(true);
    expect(player.x).toBe(2);
    expect(player.y).toBe(2);

    // Правило `oil_applies_oiled` должно наложить статус.
    expect(player.statusEffects.some((effect) => effect.type === 'oiled')).toBe(true);

    // 3. Наносим огненный урон по игроку, стоящему на масле.
    // Это имитирует любой источник fire-урона (например, огненное оружие или fireball).
    const damageBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE',
        entityId: player.id,
        sourceEntityId: null,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      damageBuilder,
      damageBuilder.root,
    );

    // 4. Проверяем, что на масле появился статус `burning`.
    const oilAfterIgnite = getOilAt(state, 2, 2);
    expect(oilAfterIgnite).toBeDefined();
    const burningAfterIgnite = oilAfterIgnite!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterIgnite).toBeDefined();
    expect(burningAfterIgnite!.duration).toBe(3);

    // 5. Завершаем ход игрока и прокручиваем раунды до environment-turn.
    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const oilAfterFirstTick = getOilAt(state, 2, 2);
    expect(oilAfterFirstTick).toBeDefined();
    expect(oilAfterFirstTick!.duration).toBe(4);
    const burningAfterFirstTick = oilAfterFirstTick!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterFirstTick).toBeDefined();
    expect(burningAfterFirstTick!.duration).toBe(2);

    // 6. Ещё один раунд — длительность уменьшается до 1.
    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const oilAfterSecondTick = getOilAt(state, 2, 2);
    expect(oilAfterSecondTick).toBeDefined();
    expect(oilAfterSecondTick!.duration).toBe(3);
    const burningAfterSecondTick = oilAfterSecondTick!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterSecondTick).toBeDefined();
    expect(burningAfterSecondTick!.duration).toBe(1);

    // 7. Третий раунд — `burning` истекает и удаляется, масло остаётся.
    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const oilAfterBurnout = getOilAt(state, 2, 2);
    expect(oilAfterBurnout).toBeDefined();
    expect(oilAfterBurnout!.statusEffects.some((s) => s.type === 'burning')).toBe(false);
    expect(oilAfterBurnout!.duration).toBe(2);
  });
});
