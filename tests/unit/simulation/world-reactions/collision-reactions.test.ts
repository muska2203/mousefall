import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
import { createTestSimulation, advanceToPlayerTurn } from '../../../helpers/simulation';
import type { GameEvent } from '../../../../src/simulation/core-types';

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'USE_ABILITY', entityId, abilityId: 'push', targets: [] },
  });
}

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

function runPush(
  state: ReturnType<typeof makeGameState>,
  {
    entityId,
    dx,
    dy,
    sourceEntityId,
    contentRulesEnabled,
  }: {
    entityId: string;
    dx: number;
    dy: number;
    sourceEntityId: string | null;
    contentRulesEnabled: boolean;
  },
) {
  state.featureFlags.contentRulesEnabled = contentRulesEnabled;
  const builder = makeBuilder(sourceEntityId ?? entityId);
  executeIntent(
    state,
    { type: 'PUSH', entityId, dx, dy, sourceEntityId },
    builder,
    builder.root,
  );
  return { builder, events: collectEvents(builder.root) as GameEvent[] };
}

describe.each([false, true])('collision reactions with contentRulesEnabled=%s', (contentRulesEnabled) => {
  it('wall collision produces damage and status via reactions', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.map.tiles[5]![8] = 'wall';
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const { events } = runPush(state, {
      entityId: enemy.id,
      dx: 1,
      dy: 0,
      sourceEntityId: player.id,
      contentRulesEnabled,
    });

    expect(enemy.hp).toBe(15);

    const expectedStatus = contentRulesEnabled ? 'dazed' : 'stunned';
    const unexpectedStatus = contentRulesEnabled ? 'stunned' : 'dazed';
    expect(enemy.statusEffects.some(e => e.type === expectedStatus)).toBe(true);
    expect(enemy.statusEffects.some(e => e.type === unexpectedStatus)).toBe(false);

    const collided = events.find(e => e.type === 'ENTITY_COLLIDED');
    expect(collided).toBeDefined();
    expect(collided!.tags).toContain('displacement.push');
    expect(collided!.tags).toContain('collision.wall');

    expect(events.some(e => e.type === 'ENTITY_DAMAGED')).toBe(true);
    expect(events.some(e => e.type === 'STATUS_APPLIED')).toBe(true);
  });

  it('actor-on-actor collision damages and applies status to both actors', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 8, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);

    const { events } = runPush(state, {
      entityId: enemy1.id,
      dx: 1,
      dy: 0,
      sourceEntityId: player.id,
      contentRulesEnabled,
    });

    expect(enemy1.hp).toBe(15);
    expect(enemy2.hp).toBe(15);

    const expectedStatus = contentRulesEnabled ? 'dazed' : 'stunned';
    expect(enemy1.statusEffects.some(e => e.type === expectedStatus)).toBe(true);
    expect(enemy2.statusEffects.some(e => e.type === expectedStatus)).toBe(true);

    const collided = events.find(e => e.type === 'ENTITY_COLLIDED');
    expect(collided).toBeDefined();
    expect(collided!.tags).toContain('displacement.push');
    expect(collided!.tags).toContain('collision.actor');
  });

  it('free cell displacement moves actor without damage or status', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const { events } = runPush(state, {
      entityId: enemy.id,
      dx: 1,
      dy: 0,
      sourceEntityId: player.id,
      contentRulesEnabled,
    });

    expect(enemy.x).toBe(8);
    expect(enemy.y).toBe(5);
    expect(enemy.hp).toBe(20);
    expect(enemy.statusEffects).toHaveLength(0);

    expect(events.some(e => e.type === 'ENTITY_DISPLACED')).toBe(true);
    expect(events.some(e => e.type === 'ENTITY_MOVED')).toBe(true);
    expect(events.some(e => e.type === 'ENTITY_DAMAGED')).toBe(false);
    expect(events.some(e => e.type === 'STATUS_APPLIED')).toBe(false);
  });
});

describe('dazed status', () => {
  it('reduces AP restoration by 1 and expires during next faction setup', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 3,
      ap: 0,
      statusEffects: [{ type: 'dazed', duration: 1, value: 0, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });

    const sim = createTestSimulation(state);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    const updatedPlayer = sim.getState().player;
    expect(updatedPlayer.ap).toBe(2);
    expect(updatedPlayer.statusEffects.some(e => e.type === 'dazed')).toBe(false);
  });
});

describe('collision reactions (misc)', () => {
  it('pushing player onto stairs does not trigger auto transition', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 4 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set('stairs_down_1', { type: 'stairs', id: 'stairs_down_1', templateId: 'stairs_down', x: 5, y: 3, blocksMovement: false, interactionKind: 'stairs' } as any);

    const { events } = runPush(state, {
      entityId: player.id,
      dx: 0,
      dy: -1,
      sourceEntityId: null,
      contentRulesEnabled: false,
    });

    expect(player.x).toBe(5);
    expect(player.y).toBe(3);

    expect(events.some((e: any) => e.type === 'STAIR_EXIT_TRIGGERED')).toBe(false);
    expect(events.some(e => e.type === 'ENTITY_MOVED')).toBe(true);
  });
});
