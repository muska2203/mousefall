import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'USE_ABILITY', entityId, abilityId: 'push', targets: [] },
  });
}

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

describe('collision reactions', () => {
  it('wall collision produces DAMAGE and APPLY_STATUS via reactions', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.map.tiles[5]![8] = 'wall';
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(player.id);
    executeIntent(state, { type: 'PUSH', entityId: enemy.id, dx: 1, dy: 0, sourceEntityId: player.id }, builder, builder.root);

    expect(enemy.hp).toBeLessThan(20);
    expect(enemy.statusEffects.some(e => e.type === 'stunned')).toBe(true);

    const events = collectEvents(builder.root);
    expect(events.some((e: any) => e.type === 'ENTITY_COLLIDED')).toBe(true);
    expect(events.some((e: any) => e.type === 'ENTITY_DAMAGED')).toBe(true);
    expect(events.some((e: any) => e.type === 'STATUS_APPLIED')).toBe(true);
  });

  it('actor-on-actor collision damages and stuns both actors', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 8, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);

    const builder = makeBuilder(player.id);
    executeIntent(state, { type: 'PUSH', entityId: enemy1.id, dx: 1, dy: 0, sourceEntityId: player.id }, builder, builder.root);

    expect(enemy1.hp).toBeLessThan(20);
    expect(enemy2.hp).toBeLessThan(20);
    expect(enemy1.statusEffects.some(e => e.type === 'stunned')).toBe(true);
    expect(enemy2.statusEffects.some(e => e.type === 'stunned')).toBe(true);
  });

  it('free cell displacement moves actor via MOVE reaction', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(player.id);
    executeIntent(state, { type: 'PUSH', entityId: enemy.id, dx: 1, dy: 0, sourceEntityId: player.id }, builder, builder.root);

    expect(enemy.x).toBe(8);
    expect(enemy.y).toBe(5);
    expect(enemy.hp).toBe(20);
    expect(enemy.statusEffects.some(e => e.type === 'stunned')).toBe(false);

    const events = collectEvents(builder.root);
    expect(events.some((e: any) => e.type === 'ENTITY_DISPLACED')).toBe(true);
    expect(events.some((e: any) => e.type === 'ENTITY_MOVED')).toBe(true);
  });

  it('pushing player onto stairs does not trigger auto transition', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 4 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set('stairs_down_1', { type: 'stairs', id: 'stairs_down_1', templateId: 'stairs_down', x: 5, y: 3, blocksMovement: false, interactionKind: 'stairs' } as any);

    const builder = makeBuilder(player.id);
    executeIntent(state, { type: 'PUSH', entityId: player.id, dx: 0, dy: -1, sourceEntityId: null }, builder, builder.root);

    expect(player.x).toBe(5);
    expect(player.y).toBe(3);

    const events = collectEvents(builder.root);
    expect(events.some((e: any) => e.type === 'STAIR_EXIT_TRIGGERED')).toBe(false);
    expect(events.some((e: any) => e.type === 'ENTITY_MOVED')).toBe(true);
  });
});
