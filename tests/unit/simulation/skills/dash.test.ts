import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { dashSkill } from '../../../../src/simulation/skills/executors/dashSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
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

  it('moves caster 2 cells on empty path', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(moveIntents).toHaveLength(2);
    expect(moveIntents[0]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(moveIntents[1]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
  });

  it('stops before wall on first step and emits BUMP', () => {
    const state = makeGameState();
    // Стена на (6,5) — по периметру карты 10×10 нет стены, но можно поставить вручную.
    state.map.tiles[5]![6] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const moveIntents = intents.filter(i => i.type === 'MOVE');
    const bumpIntents = intents.filter(i => i.type === 'BUMP');

    expect(moveIntents).toHaveLength(0);
    expect(bumpIntents).toHaveLength(1);
    expect(bumpIntents[0]).toMatchObject({ type: 'BUMP', entityId: player.id, position: { x: 5, y: 5 }, dx: 1, dy: 0 });
  });

  it('stops before wall on second step and emits BUMP at last free cell', () => {
    const state = makeGameState();
    // Стена на (7,5).
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const moveIntents = intents.filter(i => i.type === 'MOVE');
    const bumpIntents = intents.filter(i => i.type === 'BUMP');

    expect(moveIntents).toHaveLength(1);
    expect(bumpIntents).toHaveLength(1);
    expect(bumpIntents[0]).toMatchObject({ type: 'BUMP', entityId: player.id, position: { x: 6, y: 5 }, dx: 1, dy: 0 });
  });

  it('opens closed door and passes through', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5, isOpen: false, blocksMovement: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const openDoorIntents = intents.filter(i => i.type === 'OPEN_DOOR');
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(openDoorIntents).toHaveLength(1);
    expect(moveIntents).toHaveLength(2);
  });

  it('damages and pushes actor into empty cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    const pushIntents = intents.filter(i => i.type === 'PUSH');
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    expect(pushIntents).toHaveLength(1);
    expect(pushIntents[0]).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 1, dy: 0 });
    expect(moveIntents).toHaveLength(2);
  });

  it('executes push into empty cell: enemy moves, caster follows', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
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
  });

  it('pushes actor into wall: enemy takes damage and is stunned, caster stops before enemy cell and bumps', () => {
    const state = makeGameState();
    // Стена на (7,5) — цель пуша.
    state.map.tiles[5]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const bumpIntents = intents.filter(i => i.type === 'BUMP');
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    // Кастер не смог зайти в клетку врага, остался на (5,5).
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    // Враг остался на месте.
    expect(enemy.x).toBe(6);
    expect(enemy.y).toBe(5);
    // Враг получил урон (начальный + от пуша в стену).
    expect(enemy.hp).toBeLessThan(20);
    // Враг оглушён.
    expect(enemy.statusEffects.some(e => e.type === 'stunned')).toBe(true);
    // Кастер отскакивает от клетки врага.
    expect(bumpIntents).toHaveLength(1);
    expect(bumpIntents[0]).toMatchObject({ type: 'BUMP', entityId: player.id, position: { x: 5, y: 5 }, dx: 1, dy: 0 });
  });

  it('pushes actor into another actor: both take damage and are stunned', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20, armor: 0 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 7, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);

    const intents = dashSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(enemy1.x).toBe(6);
    expect(enemy1.y).toBe(5);
    expect(enemy2.x).toBe(7);
    expect(enemy2.y).toBe(5);

    expect(enemy1.hp).toBeLessThan(20);
    expect(enemy2.hp).toBeLessThan(20);
    expect(enemy1.statusEffects.some(e => e.type === 'stunned')).toBe(true);
    expect(enemy2.statusEffects.some(e => e.type === 'stunned')).toBe(true);
  });

  it('executes dash through closed door', () => {
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

  it('returns valid targets within 2 cells in 8 directions', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = dashSkill.getValidTargets(state, player);
    // 8 направлений × 2 клетки = 16 целей.
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
    const moveIntents = intents.filter(i => i.type === 'MOVE');

    expect(moveIntents).toHaveLength(2);
    expect(moveIntents[0]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(moveIntents[1]).toMatchObject({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('dash')).toBeDefined();
  });
});
