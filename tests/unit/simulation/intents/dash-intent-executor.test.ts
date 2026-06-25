import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { executeDashIntent } from '../../../../src/simulation/systems/intents/dash-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'USE_ABILITY', entityId, abilityId: 'dash', targets: [{ x: 0, y: 0 }] },
  });
}

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

describe('executeDashIntent', () => {
  it('moves caster 2 cells and emits ENTITY_MOVED with movementType dash', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);

    const moveEvents = collectEvents(builder.root).filter((e: any) => e.type === 'ENTITY_MOVED');
    expect(moveEvents).toHaveLength(2);
    expect(moveEvents.every((e: any) => e.movementType === 'dash')).toBe(true);
  });

  it('stops before wall and emits BUMP without moving', () => {
    const state = makeGameState();
    state.map.tiles[5]![6] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    const bumpEvents = collectEvents(builder.root).filter((e: any) => e.type === 'ENTITY_BUMPED');
    expect(bumpEvents).toHaveLength(1);
    expect(bumpEvents[0]).toMatchObject({ entityId: player.id, position: { x: 5, y: 5 }, dx: 1, dy: 0 });
  });

  it('stops before wall on second step and emits BUMP at last free cell', () => {
    const state = makeGameState();
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);

    const bumpEvents = collectEvents(builder.root).filter((e: any) => e.type === 'ENTITY_BUMPED');
    expect(bumpEvents).toHaveLength(1);
    expect(bumpEvents[0]).toMatchObject({ entityId: player.id, position: { x: 6, y: 5 }, dx: 1, dy: 0 });
  });

  it('opens closed door and passes through', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5, isOpen: false, blocksMovement: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(door.isOpen).toBe(true);
    expect(door.blocksMovement).toBe(false);
    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
  });

  it('pushes actor on second cell and caster stops before it', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(8);
    expect(enemy.y).toBe(5);
    expect(enemy.hp).toBeLessThan(20);
  });

  it('stops and bumps when push is blocked by wall', () => {
    const state = makeGameState();
    state.map.tiles[5]![8] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(5);
    expect(enemy.statusEffects.some(e => e.type === 'stunned')).toBe(true);
  });

  it('bumps when colliding with actor on first cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(player.id);
    executeDashIntent(state, { type: 'DASH', entityId: player.id, dx: 1, dy: 0, distance: 2 }, builder, builder.root);

    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(enemy.hp).toBeLessThan(20);

    const bumpEvents = collectEvents(builder.root).filter((e: any) => e.type === 'ENTITY_BUMPED');
    expect(bumpEvents.some((e: any) => e.entityId === player.id)).toBe(true);
  });
});
