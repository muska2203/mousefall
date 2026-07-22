/**
 * Интеграционный тест цикла масла и поджога.
 *
 * Проверяет сквозной сценарий:
 * 1. Спавн масла на клетке через debug-действие.
 * 2. Перемещение игрока на масло → наложение статуса `oiled`.
 * 3. Нанесение огненного урона по сущности на масле → поджог (`burning` на tile effect).
 * 4. Тик `burning` в фазе `environment-turn` уменьшает длительность масла.
 * 5. Статус `burning` не гаснет по своей длительности — он удаляется только вместе с маслом, когда масло полностью сгорает.
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

  it('спавн масла → oiled → огненный урон → burning → тик → полное сгорание', () => {
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

    // 5-9. Пять раундов горения: масло уменьшается на 1 за раунд, горение не гаснет.
    // После пятого раунда масло исчерпано — оно удаляется вместе с горением.
    for (let round = 1; round <= 5; round++) {
      simulation.dispatch({ type: 'END_TURN', entityId: player.id });
      advanceToPlayerTurn(simulation);

      if (round < 5) {
        const oil = getOilAt(state, 2, 2);
        expect(oil).toBeDefined();
        expect(oil!.duration).toBe(5 - round);
        const burning = oil!.statusEffects.find((s) => s.type === 'burning');
        expect(burning).toBeDefined();
        expect(burning!.duration).toBe(3);
      } else {
        expect(getOilAt(state, 2, 2)).toBeUndefined();
      }
    }
  });

  it('площадной огненный урон поджигает пустую клетку с маслом', () => {
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

    const damageBuilder = new ExecutionBuilder({
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
        tags: ['damage.magical.fire', 'target.aoe'],
      },
      damageBuilder,
      damageBuilder.root,
    );

    const oilAfterIgnite = getOilAt(state, 2, 2);
    expect(oilAfterIgnite).toBeDefined();
    const burningAfterIgnite = oilAfterIgnite!.statusEffects.find((s) => s.type === 'burning');
    expect(burningAfterIgnite).toBeDefined();
    expect(burningAfterIgnite!.duration).toBe(3);
  });
});
