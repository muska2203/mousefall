import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { dashSkill } from '../../../../src/simulation/skills/executors/dashSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
import '@simulation/ai/hunter-strategy';
import { ExecutionBuilder } from '@simulation/systems/actions/types';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 4,
    ...overrides,
  } as AbilityTemplate;
}

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'USE_ABILITY', entityId, abilityId: 'dash', targets: [{ x: 0, y: 0 }] },
  });
}

describe('dashSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['dash', mockAbility('dash', { cooldown: 4, apCost: 1 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('resolves to atomic intents for empty path', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 2, dy: 0 });
  });

  it('moves caster 2 cells on empty path', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
  });

  it('does not allow dashing when first cell is a wall', () => {
    const state = makeGameState();
    state.map.tiles[5]![6] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = dashSkill.getValidTargets(state, player);
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(false);
    expect(targets.some(p => p.x === 7 && p.y === 5)).toBe(false);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('does not allow dashing when first cell is occupied by actor', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const targets = dashSkill.getValidTargets(state, player);
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(false);
    expect(targets.some(p => p.x === 7 && p.y === 5)).toBe(false);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('stops before wall on second step and emits BUMP at last free cell', () => {
    const state = makeGameState();
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);

    const bumpEvents = builder.root.children.flatMap(n => collectEvents(n)).filter((e: any) => e.type === 'ENTITY_BUMPED');
    expect(bumpEvents).toHaveLength(1);
    expect(bumpEvents[0]).toMatchObject({ type: 'ENTITY_BUMPED', entityId: player.id, position: { x: 6, y: 5 }, dx: 1, dy: 0 });
  });

  it('opens closed door and passes through', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5, isOpen: false, blocksMovement: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(door.isOpen).toBe(true);
    expect(door.blocksMovement).toBe(false);
    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
  });

  it('damages and pushes actor on second cell while caster stops before it', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(8);
    expect(enemy.y).toBe(5);
    expect(enemy.hp).toBeLessThan(20);
  });

  it('pushes actor into wall: enemy takes damage and is stunned, caster stops before enemy cell and bumps', () => {
    const state = makeGameState();
    state.map.tiles[5]![8] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(5);
    expect(enemy.hp).toBeLessThan(20);
    expect(enemy.statusEffects.some(e => e.type === 'stunned')).toBe(true);

    const bumpEvents = builder.root.children.flatMap(n => collectEvents(n)).filter((e: any) => e.type === 'ENTITY_BUMPED');
    expect(bumpEvents.some((e: any) => e.entityId === player.id && e.position.x === 6 && e.position.y === 5)).toBe(true);
  });

  it('pushes actor into another actor: both take damage and are stunned', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 8, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(enemy1.x).toBe(7);
    expect(enemy1.y).toBe(5);
    expect(enemy2.x).toBe(8);
    expect(enemy2.y).toBe(5);

    expect(enemy1.hp).toBeLessThan(20);
    expect(enemy2.hp).toBeLessThan(20);
    expect(enemy1.statusEffects.some(e => e.type === 'stunned')).toBe(true);
    expect(enemy2.statusEffects.some(e => e.type === 'stunned')).toBe(true);
  });

  it('returns valid targets within 2 cells in allowed directions', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = dashSkill.getValidTargets(state, player);
    expect(targets).toHaveLength(16);
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(true);
    expect(targets.some(p => p.x === 4 && p.y === 4)).toBe(true);
    expect(targets.some(p => p.x === 7 && p.y === 5)).toBe(true);
    expect(targets.some(p => p.x === 7 && p.y === 7)).toBe(true);
    expect(targets.some(p => p.x === 3 && p.y === 3)).toBe(true);
  });

  it('moves caster 2 cells when target is 2 cells away', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
  });

  it('preview on empty path shows single MOVE intent for full distance', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.preview(state, player, [], { x: 6, y: 5 });
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(moveIntents).toHaveLength(1);
    expect(moveIntents[0]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 2, dy: 0 });
  });

  it('preview with actor on second cell shows MOVE, PUSH and DAMAGE', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = dashSkill.preview(state, player, [], { x: 6, y: 5 });

    expect(intents.some(i => i.type === 'MOVE' && i.entityId === player.id && i.dx === 1 && i.dy === 0)).toBe(true);
    expect(intents.some(i => i.type === 'PUSH' && i.entityId === enemy.id && i.dx === 1 && i.dy === 0)).toBe(true);
    expect(intents.some(i => i.type === 'DAMAGE' && i.entityId === enemy.id)).toBe(true);
  });

  it('preview against wall on second cell shows movement stopping before obstacle', () => {
    const state = makeGameState();
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.preview(state, player, [], { x: 6, y: 5 });
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(moveIntents).toHaveLength(1);
    expect(moveIntents[0]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
  });

  it('preview is empty when first cell is blocked', () => {
    const state = makeGameState();
    state.map.tiles[5]![6] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.preview(state, player, [], { x: 6, y: 5 });

    expect(intents).toHaveLength(0);
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('dash')).toBeDefined();
  });
});

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}
