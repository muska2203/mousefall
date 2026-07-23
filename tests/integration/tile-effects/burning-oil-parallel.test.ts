/**
 * Интеграционный тест параллельного распространения взрывов горящего масла.
 *
 * Проверяет, что взрыв масла применяется волнами: все соседние клетки
 * поджигаются одновременно, а не последовательно змейкой.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { executeIntent } from '../../../src/simulation/systems/intents/execute-intent';
import { makeGameState, makePlayer, makeTestMap } from '../../fixtures/gameState';
import { loadTestContent, setupCombatScenario } from '../combat-scenarios/helpers';
import type { ExecutionNode, GameEvent } from '../../../src/simulation/core-types';
import type { GameState } from '../../../src/simulation/types';

function createTestPlayer() {
  return makePlayer({
    x: 0,
    y: 0,
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

function findEventNodes(root: ExecutionNode, predicate: (event: GameEvent) => boolean): ExecutionNode[] {
  const result: ExecutionNode[] = [];
  const stack: ExecutionNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (predicate(node.event)) {
      result.push(node);
    }
    stack.push(...node.children);
  }

  return result;
}

function nodeDepth(node: ExecutionNode): number {
  let depth = 0;
  let current: ExecutionNode | null = node;
  while (current.parent !== null) {
    depth++;
    current = current.parent;
  }
  return depth;
}

function igniteTile(state: GameState, builder: ExecutionBuilder, position: { x: number; y: number }) {
  executeIntent(
    state,
    {
      type: 'DAMAGE_TILE',
      position,
      sourceEntityId: null,
      damage: 1,
      tags: ['damage.magical.fire'],
    },
    builder,
    builder.root,
  );
}

describe('Параллельное распространение взрывов масла', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('поджог центра 5x5 поля масла поджигает все клетки', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // Заполняем поле 5x5 маслом с отступом от края карты.
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) {
        const spawnResult = simulation.dispatch({
          type: 'DEBUG_SPAWN_TILE_EFFECT',
          entityId: player.id,
          effectType: 'oil',
          position: { x, y },
        });
        expect(spawnResult.success).toBe(true);
      }
    }

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    igniteTile(state, builder, { x: 3, y: 3 });

    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) {
        const oil = getOilAt(state, x, y);
        expect(oil, `масло на (${x}, ${y}) должно остаться`).toBeDefined();
        expect(
          oil!.statusEffects.some((s) => s.type === 'burning'),
          `масло на (${x}, ${y}) должно гореть`,
        ).toBe(true);
      }
    }
  });

  it('все соседние взрывы от центрального взрыва находятся на одной глубине дерева', () => {
    const state = makeGameState({ map: makeTestMap() }) as GameState;
    const player = createTestPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.initializeTestTurnState('player', player.id);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // 3x3 масло вокруг центра (2,2).
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

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });
    igniteTile(state, builder, { x: 2, y: 2 });

    const centerExplosions = findEventNodes(
      builder.root,
      (e) => e.type === 'TILE_EXPLODED' && e.position.x === 2 && e.position.y === 2,
    );
    expect(centerExplosions).toHaveLength(1);
    const centerExplosion = centerExplosions[0]!;

    const neighborExplosions = findEventNodes(
      builder.root,
      (e) =>
        e.type === 'TILE_EXPLODED' &&
        Math.abs(e.position.x - 2) <= 1 &&
        Math.abs(e.position.y - 2) <= 1 &&
        !(e.position.x === 2 && e.position.y === 2),
    );

    // В 3x3 поле должно быть 8 соседних взрыва.
    expect(neighborExplosions).toHaveLength(8);

    // Все соседние взрывы должны лежать на одной глубине от корня.
    // Это индикатор BFS: при DFS глубины были бы разными из-за
    // последовательного углубления по цепочкам.
    const depths = neighborExplosions.map(nodeDepth);
    const uniqueDepths = new Set(depths);
    expect(uniqueDepths.size).toBe(1);

    // Центральный взрыв глубже соседних ровно на 3 уровня:
    // TILE_DAMAGED(center) → TILE_EFFECT_STATUS_APPLIED(center) → TILE_EXPLODED(center).
    const neighborDepth = depths[0]!;
    expect(nodeDepth(centerExplosion)).toBe(neighborDepth - 3);
  });
});
