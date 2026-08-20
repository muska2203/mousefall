/**
 * Интеграционные тесты облака взвешанной муки (flour_cloud).
 *
 * Проверяет сквозной цикл на реальном контенте:
 * 1. Бросок flour_pouch (USE_ITEM) создаёт облако радиуса 1 на слое aboveGround;
 *    blocksLOS — мировая реакция TILE_EFFECT_CHANGED → UPDATE_FOG пересчитывает
 *    FOV в том же исполнении.
 * 2. Сокрытие (concealsEntities): враг внутри облака не виден игроку
 *    с дистанции > 1 (isEntityConcealedFrom), и симметрично игрок в облаке
 *    не виден врагу (canSeePlayer); вплотную (дистанция 1) видимость есть.
 * 3. Огненный урон по клетке облака поджигает муку (правило
 *    fire_tile_damage_ignites_flour) → взрыв (TILE_EXPLODED, урон 5, радиус 1)
 *    → эффект расходуется (consumesEffect, REMOVE_TILE_EFFECT).
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {updateFOV} from '../../../src/simulation/systems/fov';
import {isEntityConcealedFrom} from '../../../src/simulation/state';
import {canSeePlayer} from '../../../src/simulation/ai/ai-helpers';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {executeIntent} from '../../../src/simulation/systems/intents/execute-intent';
import {makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {loadTestContent, setupCombatScenario} from '../combat-scenarios/helpers';
import type {GameEvent, GameState} from '../../../src/simulation/types';
import type {EntityId, ExecutionNode} from '../../../src/simulation/core-types';
import type {Entity} from '../../../src/simulation/types';

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
      { instanceId: 'flour_pouch_1', templateId: 'flour_pouch', quantity: 5, grantedAbilities: [], affixes: [] },
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

function makeStateWith(entities: Entity[]): GameState {
  const state = makeGameState({ map: makeTestMap() }) as GameState;
  for (const entity of entities) {
    state.entities.set(entity.id, entity);
    if (entity.type === 'player') state.player = entity;
  }
  return state;
}

function findNode(node: ExecutionNode, predicate: (event: GameEvent) => boolean): ExecutionNode | undefined {
  if (predicate(node.event)) return node;
  for (const child of node.children) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function collectEventTypes(node: ExecutionNode): string[] {
  return [node.event.type, ...node.children.flatMap(collectEventTypes)];
}

describe('Облако взвешанной муки (flour_cloud)', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('бросок flour_pouch создаёт облако радиуса 1 и сразу пересчитывает FOV (blocksLOS)', () => {
    const player = createTestPlayer();
    const state = makeStateWith([player]);
    updateFOV(state); // начальный обзор: цель броска видна
    expect(state.visible[5]![4]).toBe(true);
    expect(state.visible[5]![6]).toBe(true);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    const result = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'flour_pouch_1',
      targetPosition: { x: 4, y: 5 },
    });
    expect(result.success).toBe(true);
    expect(player.inventory.find(i => i.instanceId === 'flour_pouch_1')!.quantity).toBe(4);

    // Облако создано на всех 9 клетках радиуса 1 вокруг (4,5), слой aboveGround.
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 5; x++) {
        expect(
          state.tileEffects[y]![x]!.aboveGround?.type,
          `облако муки на (${x}, ${y})`,
        ).toBe('flour_cloud');
      }
    }

    // Мировая реакция на появление облака пересчитала FOV в том же исполнении.
    const changedNode = findNode(result.phases[0]!.actions[0]!, (event) =>
      event.type === 'TILE_EFFECT_CHANGED' && event.effectType === 'flour_cloud');
    expect(changedNode).toBeDefined();
    expect(findNode(changedNode!, (event) => event.type === 'FOG_UPDATED')).toBeDefined();

    // Ближайшая клетка облака видна (блокиратор виден, как стена),
    // клетки за облаком скрыты без дополнительного хода игрока.
    expect(state.visible[5]![3]).toBe(true);
    expect(state.visible[5]![6]).toBe(false);
  });

  it('враг внутри облака скрыт от игрока, игрок в облаке скрыт от врага (дистанция > 1)', () => {
    const player = createTestPlayer();
    const enemy = makeEnemy({ id: 'enemy_in_cloud', x: 4, y: 5 });
    const state = makeStateWith([player, enemy]);
    const simulation = createDebugSimulation(state);

    // Контроль без облака: враг видит игрока, сокрытия нет.
    expect(canSeePlayer(enemy, state)).toBe(true);
    expect(isEntityConcealedFrom(state, enemy, player)).toBe(false);

    // Облако на клетке врага и на клетке игрока.
    for (const position of [{ x: 4, y: 5 }, { x: 2, y: 5 }]) {
      const spawn = simulation.dispatch({
        type: 'DEBUG_SPAWN_TILE_EFFECT',
        entityId: player.id,
        effectType: 'flour_cloud',
        position,
      });
      expect(spawn.success).toBe(true);
    }

    // Дистанция 2: враг в облаке скрыт от игрока, игрок в облаке скрыт от врага.
    expect(isEntityConcealedFrom(state, enemy, player)).toBe(true);
    expect(canSeePlayer(enemy, state)).toBe(false);

    // Подходим вплотную (дистанция 1): сокрытие перестаёт действовать в обе стороны.
    const move = simulation.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(move.success).toBe(true);
    expect(player.x).toBe(3);
    expect(isEntityConcealedFrom(state, enemy, player)).toBe(false);
    expect(canSeePlayer(enemy, state)).toBe(true);
  });

  it('огненный урон по клетке облака поджигает муку: взрыв (урон 5, радиус 1) расходует эффект', () => {
    const player = createTestPlayer();
    const enemy = makeEnemy({ id: 'enemy_near_cloud', x: 4, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith([player, enemy]);
    const simulation = createDebugSimulation(state);

    const spawn = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'flour_cloud',
      position: { x: 5, y: 5 },
    });
    expect(spawn.success).toBe(true);
    expect(state.tileEffects[5]![5]!.aboveGround?.type).toBe('flour_cloud');

    // Огненный урон по клетке облака (как в burning-oil-explosion).
    const igniteBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED', isFieldEvent: false,
      action: { type: 'END_TURN', entityId: player.id },
    });
    executeIntent(
      state,
      {
        type: 'DAMAGE_TILE',
        position: { x: 5, y: 5 },
        sourceEntityId: null,
        damage: 1,
        tags: ['damage.magical.fire'],
      },
      igniteBuilder,
      igniteBuilder.root,
    );

    // Мука подожжена (fire_tile_damage_ignites_flour) и детонировала.
    const eventTypes = collectEventTypes(igniteBuilder.root);
    expect(eventTypes).toContain('TILE_EXPLODED');
    expect(eventTypes).toContain('TILE_EFFECT_REMOVED');

    // consumesEffect: эффект расходован взрывом.
    expect(state.tileEffects[5]![5]!.aboveGround).toBeUndefined();

    // Враг на соседней клетке (4,5) в радиусе взрыва получил урон 5 (магический огонь).
    expect(enemy.hp).toBe(15);
  });
});
