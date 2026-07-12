/**
 * Тесты нового фракционного планировщика ходов.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createTestSimulation, advanceToPlayerTurn } from '../../helpers/simulation';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { EntityId, Entity, EnemyEntity, SimulationResult } from '../../../src/simulation/types';
import type { ExecutionNode } from '../../../src/simulation/systems/actions/types';
import { createDefaultAIState } from '../../../src/simulation/ai/ai-state';

function collectEvents(node: ExecutionNode): ExecutionNode['event'][] {
  const events: ExecutionNode['event'][] = [node.event];
  for (const child of node.children) {
    events.push(...collectEvents(child));
  }
  return events;
}

describe('Faction scheduler', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('runs the full faction cycle and increments the round', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    const results = advanceToPlayerTurn(sim);

    const sides = results.flatMap((r) => r.phases.map((p) => p.side));
    expect(sides).toContain('allies');
    expect(sides).toContain('enemies');
    expect(sides).toContain('environment');
    expect(sides).toContain('round_recovery');
    expect(sides).toContain('player');

    const envIndex = sides.indexOf('environment');
    const recoveryIndex = sides.indexOf('round_recovery');
    expect(envIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(envIndex).toBeLessThan(recoveryIndex);

    expect(sim.getState().turn.round).toBeGreaterThan(0);
    expect(sim.isPlayerTurn()).toBe(true);
  });

  it('allows explicit END_TURN while AP > 0', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    const result = sim.dispatch({ type: 'END_TURN', entityId: player.id });
    expect(result.success).toBe(true);

    const next = sim.step();
    expect(next.phases[0]?.side).toBe('allies');
  });

  it('stunned player can only END_TURN', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 1,
      maxAp: 1,
      statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const sim = createTestSimulation(state);
    const moveResult = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });
    expect(moveResult.success).toBe(false);

    const endResult = sim.dispatch({ type: 'END_TURN', entityId: player.id });
    expect(endResult.success).toBe(true);
  });

  it('AI actor can take multiple actions while AP remains', () => {
    const player = makePlayer({ x: 5, y: 6, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({ x: 5, y: 3, ap: 2, maxAp: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    const results = advanceToPlayerTurn(sim);

    const enemyActions = results
      .flatMap((r) => r.phases.filter((p) => p.side === 'enemies'))
      .flatMap((p) => p.actions)
      .flatMap((action) => collectEvents(action));

    const moveEvents = enemyActions.filter(
      (e) => e.type === 'ACTION_APPLIED' && (e as { action?: { type: string } }).action?.type === 'MOVE',
    );
    expect(moveEvents.length).toBeGreaterThanOrEqual(2);
    expect(sim.getState().entities.get(enemy.id)?.y).toBe(5);
  });

  it('ROUND_RECOVERY removes dead entities and increments the round', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({ x: 6, y: 5, isAlive: false });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    expect(sim.getState().entities.has(enemy.id)).toBe(false);
    expect(sim.getState().turn.round).toBeGreaterThan(0);
  });

  it('skips empty factions', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    const results = advanceToPlayerTurn(sim);

    const sides = results.flatMap((r) => r.phases.map((p) => p.side));
    expect(sides).toContain('allies');
    expect(sides).toContain('enemies');
    expect(sides).toContain('neutrals');
    expect(sides).toContain('environment');
    expect(sides).toContain('round_recovery');
    expect(sim.getState().turn.round).toBeGreaterThan(0);
    expect(sim.isPlayerTurn()).toBe(true);
  });

  it('stops stepping when game phase is not playing', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, phase: 'dead' });
    const sim = createTestSimulation(state);

    const result = sim.step();

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(0);
    expect(result.hasMoreSteps).toBe(false);
  });

  it('does not loop infinitely on empty phases', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 0, maxAp: 1 });
    const state = makeGameState({ player });
    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    let steps = 0;
    let result: SimulationResult;
    do {
      result = sim.step();
      steps++;
    } while (result.hasMoreSteps && steps < 100);

    expect(steps).toBeLessThan(100);
    expect(sim.isPlayerTurn()).toBe(true);
  });

  it('stunned AI cancels prepared ability and ends turn', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }],
    });
    enemy.aiState.preparedAbility = { abilityId: 'dash', targets: [{ x: 5, y: 5 }] };

    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.initializeTestTurnState('enemies', enemy.id);

    const result = sim.step();

    expect(result.success).toBe(true);
    const events = result.phases
      .flatMap((p) => p.actions)
      .flatMap((action) => collectEvents(action));
    expect(events.some((e) => e.type === 'ABILITY_PREPARED_CANCELLED')).toBe(true);

    const afterEnemy = sim.getState().entities.get(enemy.id) as EnemyEntity;
    expect(afterEnemy.aiState.preparedAbility).toBeNull();
  });

  it('initializeTestTurnState correctly sets player turn', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player });
    const sim = createTestSimulation(state);

    expect(sim.isPlayerTurn()).toBe(true);
  });
});
