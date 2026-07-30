/**
 * Интеграционные тесты дыма (слой aboveGround, blocksLOS).
 *
 * Проверяет сквозной цикл:
 * 1. Бросок smoke_bomb создаёт дым, который сразу блокирует обзор:
 *    мировая реакция TILE_EFFECT_CHANGED → UPDATE_FOG пересчитывает FOV
 *    в том же исполнении, не дожидаясь следующего хода игрока.
 * 2. Дым не блокирует движение.
 * 3. Исчезновение дыма в ход окружения восстанавливает обзор
 *    (реакция TILE_EFFECT_REMOVED → UPDATE_FOG).
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {updateFOV} from '../../../src/simulation/systems/fov';
import {makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {loadTestContent, setupCombatScenario} from '../combat-scenarios/helpers';
import {advanceToPlayerTurn} from '../../helpers/simulation';
import type {GameEvent, GameState, SimulationResult} from '../../../src/simulation/types';
import type {ExecutionNode} from '../../../src/simulation/core-types';

function createTestPlayer() {
  return makePlayer({
    x: 2,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    inventory: [
      { instanceId: 'smoke_bomb_1', templateId: 'smoke_bomb', quantity: 5, grantedAbilities: [] },
    ],
  });
}

function createDebugSimulation(state: GameState): GameSimulation {
  const simulation = GameSimulation.loadSavedGame(state);
  simulation.initializeTestTurnState('player', state.player.id);
  simulation.setDebugEnabled(true);
  simulation.setContentRulesEnabled(true);
  return simulation;
}

function findNode(node: ExecutionNode, predicate: (event: GameEvent) => boolean): ExecutionNode | undefined {
  if (predicate(node.event)) return node;
  for (const child of node.children) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function forEachActionRoot(results: SimulationResult[], visit: (root: ExecutionNode) => void): void {
  for (const result of results) {
    for (const phase of result.phases) {
      for (const action of phase.actions) {
        visit(action);
      }
    }
  }
}

describe('Дым (aboveGround, blocksLOS)', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('бросок smoke_bomb создаёт дым и сразу пересчитывает FOV (реакция → UPDATE_FOG)', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);
    updateFOV(state); // начальный обзор: вся комната видна, цель броска доступна
    expect(state.visible[5]![6]).toBe(true);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    const result = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'smoke_bomb_1',
      targetPosition: { x: 4, y: 5 },
    });
    expect(result.success).toBe(true);
    expect(player.inventory.find(i => i.instanceId === 'smoke_bomb_1')!.quantity).toBe(4);

    // Дым создан на слое aboveGround.
    expect(state.tileEffects[5]![4]!.aboveGround?.type).toBe('smoke');

    // Мировая реакция на появление дыма пересчитала FOV в том же исполнении.
    const changedNode = findNode(result.phases[0]!.actions[0]!, (event) =>
      event.type === 'TILE_EFFECT_CHANGED' && event.effectType === 'smoke');
    expect(changedNode).toBeDefined();
    expect(findNode(changedNode!, (event) => event.type === 'FOG_UPDATED')).toBeDefined();

    // Ближайшая клетка дыма видна (блокиратор виден, как стена),
    // клетки за ней скрыты без дополнительного хода игрока.
    expect(state.visible[5]![3]).toBe(true);
    expect(state.visible[5]![4]).toBe(false);
    expect(state.visible[5]![6]).toBe(false);
    expect(state.visible[5]![7]).toBe(false);
  });

  it('дым не блокирует движение', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = createDebugSimulation(state);

    const spawn = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'smoke',
      position: { x: 3, y: 5 },
    });
    expect(spawn.success).toBe(true);
    expect(state.tileEffects[5]![3]!.aboveGround?.type).toBe('smoke');

    const move = simulation.dispatch({
      type: 'MOVE',
      entityId: player.id,
      dx: 1,
      dy: 0,
    });
    expect(move.success).toBe(true);
    expect(player.x).toBe(3);
    expect(player.y).toBe(5);
  });

  it('исчезновение дыма в ход окружения восстанавливает обзор (реакция → UPDATE_FOG)', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = createDebugSimulation(state);

    const spawn = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'smoke',
      position: { x: 4, y: 5 },
    });
    expect(spawn.success).toBe(true);
    // Реакция на появление дыма скрыла клетки за ним.
    expect(state.visible[5]![6]).toBe(false);

    // Ускоряем истечение: дым рассеивается на ближайшем тике окружения.
    state.tileEffects[5]![4]!.aboveGround!.duration = 1;

    // Завершаем ход и прокручиваем раунд: тик окружения удаляет дым,
    // реакция на TILE_EFFECT_REMOVED пересчитывает FOV без действий игрока.
    const endTurn = simulation.dispatch({ type: 'END_TURN', entityId: player.id });
    expect(endTurn.success).toBe(true);
    const stepResults = advanceToPlayerTurn(simulation);

    expect(state.tileEffects[5]![4]!.aboveGround).toBeUndefined();

    let removedNode: ExecutionNode | undefined;
    forEachActionRoot(stepResults, (root) => {
      removedNode ??= findNode(root, (event) =>
        event.type === 'TILE_EFFECT_REMOVED' && event.effectType === 'smoke');
    });
    expect(removedNode).toBeDefined();
    expect(findNode(removedNode!, (event) => event.type === 'FOG_UPDATED')).toBeDefined();

    // Обзор восстановлен.
    expect(state.visible[5]![6]).toBe(true);
  });
});
