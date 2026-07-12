/**
 * Тесты хода окружения (environment turn).
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createTestSimulation, advanceToPlayerTurn } from '../../helpers/simulation';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { EntityId, Entity, ExecutionNode } from '../../../src/simulation/types';

function collectEvents(node: ExecutionNode): ExecutionNode['event'][] {
  const events: ExecutionNode['event'][] = [node.event];
  for (const child of node.children) {
    events.push(...collectEvents(child));
  }
  return events;
}

describe('Environment turn', () => {
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

  it('runs after all factions and before round recovery', () => {
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
    const envIndex = sides.indexOf('environment');
    const recoveryIndex = sides.indexOf('round_recovery');

    expect(envIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(envIndex).toBeLessThan(recoveryIndex);
  });

  it('does not increment the round', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const state = makeGameState({ player });

    const sim = createTestSimulation(state);
    const roundBefore = sim.getState().turn.round;

    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    // Дойти до фазы environment и зафиксировать раунд.
    let roundDuringEnvironment = roundBefore;
    while ((sim as any).turnState.phase !== 'environment-turn') {
      sim.step();
    }
    roundDuringEnvironment = sim.getState().turn.round;

    advanceToPlayerTurn(sim);

    expect(roundDuringEnvironment).toBe(roundBefore);
    expect(sim.getState().turn.round).toBe(roundBefore + 1);
  });

  it('ticks status effects on non-actor entities', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const door = makeDoor({
      x: 6,
      y: 5,
      hp: 100,
      maxHp: 100,
      statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [door.id, door],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    const results: ReturnType<typeof sim.step>[] = [];
    while ((sim as any).turnState.phase !== 'round-recovery') {
      results.push(sim.step());
    }

    const envPhase = results
      .flatMap((r) => r.phases)
      .find((p) => p.side === 'environment');

    expect(envPhase).toBeDefined();

    const envEvents = envPhase!.actions.flatMap((a) => collectEvents(a));
    expect(envEvents.some((e) => e.type === 'STATUS_TICKED' && e.entityId === door.id)).toBe(true);
    expect(envEvents.some((e) => e.type === 'ENTITY_DAMAGED' && e.targetId === door.id)).toBe(true);

    const updatedDoor = sim.getState().entities.get(door.id);
    expect(updatedDoor).toBeDefined();
    expect('statusEffects' in updatedDoor! && updatedDoor.statusEffects.find((e) => e.type === 'burning')?.duration).toBe(1);
  });

  it('does not tick actor status effects during environment turn', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    const results: ReturnType<typeof sim.step>[] = [];
    while ((sim as any).turnState.phase !== 'round-recovery') {
      results.push(sim.step());
    }

    const envEvents = results
      .flatMap((r) => r.phases)
      .filter((p) => p.side === 'environment')
      .flatMap((p) => p.actions)
      .flatMap((a) => collectEvents(a));

    expect(envEvents.some((e) => e.type === 'STATUS_TICKED' && e.entityId === enemy.id)).toBe(false);
  });

  it('emits a single TURN_BEGAN and reports no state change when nothing ticks', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const state = makeGameState({ player });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    const results: ReturnType<typeof sim.step>[] = [];
    while ((sim as any).turnState.phase !== 'round-recovery') {
      results.push(sim.step());
    }

    const envPhase = results
      .flatMap((r) => r.phases)
      .find((p) => p.side === 'environment');

    expect(envPhase).toBeDefined();
    const envEvents = envPhase!.actions.flatMap((a) => collectEvents(a));
    const turnBeganEvents = envEvents.filter((e) => e.type === 'TURN_BEGAN');
    expect(turnBeganEvents).toHaveLength(1);
    expect(turnBeganEvents[0]).toMatchObject({
      side: 'environment',
      round: 0,
      actorId: null,
    });

    const envResult = results.find((r) => r.phases.some((p) => p.side === 'environment'));
    expect(envResult!.stateChanged).toBe(false);
  });

  it('cleans up entities killed by environment status ticks in round recovery', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const door = makeDoor({
      x: 6,
      y: 5,
      hp: 1,
      maxHp: 100,
      statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [door.id, door],
      ]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    expect(sim.getState().entities.has(door.id)).toBe(false);
  });
});
