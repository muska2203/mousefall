/**
 * Интеграционный сценарий: moveCost террейна при движении (фаза 1 слоистой модели клетки).
 *
 * Проверяет:
 * - шаг на песок (moveCost 2) списывает 2 AP за один MOVE;
 * - шаг на пол (moveCost 1) списывает 1 AP;
 * - при нехватке AP шаг на песок отклоняется.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {resetRegistry} from '../../src/content/registry';
import {createTestSimulation} from '../helpers/simulation';
import {initObjectContentRegistry, makeGameState, makePlayer} from '../fixtures/gameState';

describe('Terrain move cost — движение по песку', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('шаг на песок списывает 2 AP за один MOVE', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    state.map.tiles[5]![6] = 'sand';
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(true);
    expect(sim.getState().player.x).toBe(6);
    expect(sim.getState().player.ap).toBe(0);
  });

  it('шаг на пол списывает 1 AP', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(true);
    expect(sim.getState().player.ap).toBe(1);
  });

  it('при ap = 1 шаг на песок отклоняется', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 1 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    state.map.tiles[5]![6] = 'sand';
    const sim = createTestSimulation(state);

    const result = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });

    expect(result.success).toBe(false);
    expect(sim.getState().player.x).toBe(5);
    expect(sim.getState().player.ap).toBe(1);
  });
});
