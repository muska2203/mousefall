/**
 * Интеграционный тест полного боевого цикла способностей rain и oil_flask.
 *
 * Проверяет сквозной сценарий:
 * 1. Игрок кастует rain на клетку → появляется water.
 * 2. Игрок кастует oil_flask на другую клетку → появляется oil.
 * 3. Огненный урон по сущности на масле → поджог (burning на tile effect).
 * 4. Завершение хода → burning тикает, длительность уменьшается.
 * 5. Игрок кастует rain на горящее масло → масло заменяется водой, burning удаляется.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { executeIntent } from '../../../src/simulation/systems/intents/execute-intent';
import { makeGameState, makePlayer, makeTestMap, makeEnemy } from '../../fixtures/gameState';
import { loadTestContent, setupCombatScenario } from '../combat-scenarios/helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import type { GameState } from '../../../src/simulation/types';

function createTestPlayer() {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    abilities: [
      { templateId: 'rain', source: 'innate', level: 1, currentCooldown: 0 },
      { templateId: 'oil_flask', source: 'innate', level: 1, currentCooldown: 0 },
    ],
  });
}

function getTileEffectAt(state: GameState, x: number, y: number, effectType: string) {
  return state.tileEffects[y]?.[x]?.[effectType];
}

describe('Цикл способностей rain и oil_flask', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('rain → oil → fire → burning tick → rain тушит горящее масло', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    // 1. Игрок кастует rain на (6,5) → появляется water.
    const rainResult = simulation.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'rain',
      targets: [{ x: 6, y: 5 }],
    });
    expect(rainResult.success).toBe(true);

    const waterAfterRain = getTileEffectAt(state, 6, 5, 'water');
    expect(waterAfterRain).toBeDefined();
    expect(waterAfterRain!.duration).toBe(4);

    // 2. Игрок кастует oil_flask на (7,5) → появляется oil.
    const oilResult = simulation.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'oil_flask',
      targets: [{ x: 7, y: 5 }],
    });
    expect(oilResult.success).toBe(true);

    const oilAfterFlask = getTileEffectAt(state, 7, 5, 'oil');
    expect(oilAfterFlask).toBeDefined();
    expect(oilAfterFlask!.duration).toBe(5);
    expect(oilAfterFlask!.statusEffects).toHaveLength(0);

    // 3. Создаём врага на клетке с маслом и наносим огненный урон.
    const enemy = makeEnemy({ id: 'enemy_test_oil', x: 7, y: 5, hp: 100, maxHp: 100 });
    state.entities.set(enemy.id, enemy);

    const damageBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      damageBuilder,
      damageBuilder.root,
    );

    const oilAfterIgnite = getTileEffectAt(state, 7, 5, 'oil');
    expect(oilAfterIgnite).toBeDefined();
    const burningAfterIgnite = oilAfterIgnite!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterIgnite).toBeDefined();
    expect(burningAfterIgnite!.duration).toBe(3);

    // 4. Завершаем ход, дожидаемся environment-turn → burning тикает.
    simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(simulation);

    const oilAfterTick = getTileEffectAt(state, 7, 5, 'oil');
    expect(oilAfterTick).toBeDefined();
    expect(oilAfterTick!.duration).toBe(4);
    const burningAfterTick = oilAfterTick!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterTick).toBeDefined();
    expect(burningAfterTick!.duration).toBe(2);

    // 5. Игрок кастует rain на горящее масло → масло заменяется водой, burning удаляется.
    const extinguishResult = simulation.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'rain',
      targets: [{ x: 7, y: 5 }],
    });
    expect(extinguishResult.success).toBe(true);

    expect(getTileEffectAt(state, 7, 5, 'oil')).toBeUndefined();
    expect(getTileEffectAt(state, 7, 5, 'water')).toBeDefined();
  });
});
