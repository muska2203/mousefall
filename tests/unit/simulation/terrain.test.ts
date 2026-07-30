/**
 * Тесты террейн-зависимых проверок состояния (фаза 1 слоистой модели клетки).
 *
 * Проверяет:
 * - isBlocked / isTileWalkableForPlayer зависят от `walkable` шаблона террейна;
 * - blocksLOS зависит от `blocksLOS` шаблона террейна;
 * - fail-safe: неизвестный id террейна непроходим;
 * - terrainHasTag различает тег 'ground';
 * - moveCost террейна влияет на стоимость MOVE в action-cost-resolver.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {blocksLOS, isBlocked, isTerrainWalkable, terrainHasTag} from '../../../src/simulation/state';
import {DefaultActionPointCostResolver} from '../../../src/simulation/systems/action-cost-resolver';
import {resetRegistry} from '../../../src/content/registry';
import {createTestSimulation} from '../../helpers/simulation';
import {initObjectContentRegistry, makeGameState, makePlayer} from '../../fixtures/gameState';

describe('Террейн: проходимость и обзор', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('isBlocked: стена непроходима, пол проходим', () => {
    const state = makeGameState();
    // (1, 1) — пол, (0, 0) — стена периметра в makeTestMap.
    expect(isBlocked(state, 1, 1)).toBe(false);
    expect(isBlocked(state, 0, 0)).toBe(true);
  });

  it('isBlocked: неизвестный id террейна непроходим (fail-safe)', () => {
    const state = makeGameState();
    state.map.tiles[3]![3] = 'unknown_terrain';
    expect(isBlocked(state, 3, 3)).toBe(true);
  });

  it('isTileWalkableForPlayer: учитывает walkable террейна', () => {
    const state = makeGameState();
    const sim = createTestSimulation(state);
    expect(sim.isTileWalkableForPlayer({ x: 2, y: 2 })).toBe(true);
    expect(sim.isTileWalkableForPlayer({ x: 0, y: 0 })).toBe(false);
    state.map.tiles[4]![4] = 'unknown_terrain';
    expect(sim.isTileWalkableForPlayer({ x: 4, y: 4 })).toBe(false);
  });

  it('isTileWalkableForPlayer: песок проходим, несмотря на moveCost 2', () => {
    const state = makeGameState();
    state.map.tiles[5]![6] = 'sand';
    const sim = createTestSimulation(state);
    expect(sim.isTileWalkableForPlayer({ x: 6, y: 5 })).toBe(true);
  });

  it('blocksLOS: стена блокирует обзор, пол — нет', () => {
    const state = makeGameState();
    expect(blocksLOS(state, 0, 0)).toBe(true);
    expect(blocksLOS(state, 1, 1)).toBe(false);
  });

  it('blocksLOS: неизвестный id террейна обзор не блокирует', () => {
    const state = makeGameState();
    state.map.tiles[3]![3] = 'unknown_terrain';
    expect(blocksLOS(state, 3, 3)).toBe(false);
  });

  it('isTerrainWalkable / terrainHasTag: базовая семантика тегов и проходимости', () => {
    expect(isTerrainWalkable('floor')).toBe(true);
    expect(isTerrainWalkable('wall')).toBe(false);
    expect(isTerrainWalkable(undefined)).toBe(false);
    expect(terrainHasTag('floor', 'ground')).toBe(true);
    expect(terrainHasTag('sand', 'ground')).toBe(true);
    expect(terrainHasTag('wall', 'ground')).toBe(false);
    expect(terrainHasTag(undefined, 'ground')).toBe(false);
  });
});

describe('Террейн: moveCost в стоимости MOVE', () => {
  const resolver = new DefaultActionPointCostResolver();

  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('шаг на пол стоит 1 AP, шаг на песок — 2 AP', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 3, ap: 3 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    // (6, 5) — пол, (5, 4) — песок.
    state.map.tiles[4]![5] = 'sand';

    expect(resolver.getCost({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 }, state)).toBe(1);
    expect(resolver.getCost({ type: 'MOVE', entityId: player.id, dx: 0, dy: -1 }, state)).toBe(2);
  });

  it('шаг на неизвестный террейн стоит 1 AP (fallback)', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 3, ap: 3 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    state.map.tiles[5]![6] = 'unknown_terrain';

    expect(resolver.getCost({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 }, state)).toBe(1);
  });
});
