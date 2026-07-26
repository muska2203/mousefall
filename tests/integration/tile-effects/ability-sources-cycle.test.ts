/**
 * Интеграционный тест полного боевого цикла расходников water_ball и oil_bottle.
 *
 * Проверяет сквозной сценарий:
 * 1. Игрок использует water_ball на клетку → появляется water.
 * 2. Игрок использует oil_bottle на другую клетку → появляется oil.
 * 3. Огненный урон по сущности на масле → поджог (burning на tile effect).
 * 4. Завершение хода → burning тикает, уменьшая длительность масла; сам burning не гаснет.
 * 5. Игрок использует water_ball на горящее масло → масло заменяется водой, burning удаляется.
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {executeIntent} from '../../../src/simulation/systems/intents/execute-intent';
import {makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {loadTestContent, setupCombatScenario} from '../combat-scenarios/helpers';
import {advanceToPlayerTurn} from '../../helpers/simulation';
import type {GameState} from '../../../src/simulation/types';

function createTestPlayer() {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    inventory: [
      { instanceId: 'water_ball_1', templateId: 'water_ball', quantity: 5, grantedAbilities: [] },
      { instanceId: 'oil_bottle_1', templateId: 'oil_bottle', quantity: 5, grantedAbilities: [] },
    ],
  });
}

function getTileEffectAt(state: GameState, x: number, y: number, effectType: string) {
  return state.tileEffects[y]?.[x]?.[effectType];
}

describe('Цикл расходников water_ball и oil_bottle', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('water_ball → oil_bottle → fire → burning tick → water_ball тушит горящее масло', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);
    // Делаем целевые клетки видимыми.
    state.visible[5]![6] = true;
    state.visible[5]![7] = true;

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    // 1. Игрок использует water_ball на (6,5) → появляется water.
    const waterBallResult = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'water_ball_1',
      targetPosition: { x: 6, y: 5 },
    });
    expect(waterBallResult.success).toBe(true);
    expect(player.inventory.find(i => i.instanceId === 'water_ball_1')!.quantity).toBe(4);

    const waterAfterBall = getTileEffectAt(state, 6, 5, 'water');
    expect(waterAfterBall).toBeDefined();
    expect(waterAfterBall!.duration).toBe(4);

    // 2. Игрок использует oil_bottle на (7,5) → появляется oil.
    const oilResult = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'oil_bottle_1',
      targetPosition: { x: 7, y: 5 },
    });
    expect(oilResult.success).toBe(true);
    expect(player.inventory.find(i => i.instanceId === 'oil_bottle_1')!.quantity).toBe(4);

    const oilAfterBottle = getTileEffectAt(state, 7, 5, 'oil');
    expect(oilAfterBottle).toBeDefined();
    expect(oilAfterBottle!.duration).toBe(5);
    expect(oilAfterBottle!.statusEffects).toHaveLength(0);

    // 3. Создаём врага на клетке с маслом и наносим огненный урон.
    const enemy = makeEnemy({ id: 'enemy_test_oil', x: 7, y: 5, hp: 100, maxHp: 100 });
    state.entities.set(enemy.id, enemy);

    const damageBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
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
    // Бесконечный статус горения не тратит свою длительность.
    expect(burningAfterTick!.duration).toBe(3);

    // 5. Игрок использует water_ball на горящее масло → масло заменяется водой, burning удаляется.
    const extinguishResult = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'water_ball_1',
      targetPosition: { x: 7, y: 5 },
    });
    expect(extinguishResult.success).toBe(true);

    expect(getTileEffectAt(state, 7, 5, 'oil')).toBeUndefined();
    expect(getTileEffectAt(state, 7, 5, 'water')).toBeDefined();
  });
});
