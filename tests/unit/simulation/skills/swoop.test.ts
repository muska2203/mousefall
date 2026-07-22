import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { swoopSkill } from '../../../../src/simulation/skills/executors/swoopSkill';
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
    cooldown: 2,
    tags: ['delivery.ability', 'delivery.movement', 'attack.melee', 'target.aoe', 'effect.knockback'],
    ...overrides,
  } as AbilityTemplate;
}

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'USE_ABILITY', entityId, abilityId: 'swoop', targets: [{ x: 0, y: 0 }] },
  });
}

describe('swoopSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['swoop', mockAbility('swoop', { cooldown: 2, apCost: 2 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('swoop')).toBeDefined();
  });

  it('returns valid jump targets within radius 2 excluding current cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = swoopSkill.getValidTargets(state, player);

    // Квадрат 5×5 минус центр = 24 цели.
    expect(targets).toHaveLength(24);
    expect(targets.some(p => p.x === 5 && p.y === 5)).toBe(false);
    expect(targets.some(p => p.x === 7 && p.y === 7)).toBe(true);
    expect(targets.some(p => p.x === 3 && p.y === 3)).toBe(true);
  });

  it('excludes walls and blocked cells from valid targets', () => {
    const state = makeGameState();
    // Стена и враг в радиусе 2.
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_block', x: 4, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const targets = swoopSkill.getValidTargets(state, player);

    expect(targets.some(p => p.x === 7 && p.y === 6)).toBe(false); // стена
    expect(targets.some(p => p.x === 4 && p.y === 5)).toBe(false); // занята врагом
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(true);  // свободна
  });

  it('moves caster to empty target cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const jumpIntents = intents.filter(i => i.type === 'JUMP');

    expect(jumpIntents).toHaveLength(1);
    expect(jumpIntents[0]).toMatchObject({ type: 'JUMP', entityId: player.id, dx: 2, dy: 0 });
  });

  it('deals DAMAGE_TILE damage and pushes enemy in aoe', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');
    const pushIntents = intents.filter(i => i.type === 'PUSH');

    expect(damageTileIntents).toHaveLength(9);
    expect(damageTileIntents.every(i => i.tags.includes('damage.physical.blunt'))).toBe(true);
    expect(damageTileIntents.every(i => i.tags.includes('target.aoe'))).toBe(true);
    expect(pushIntents).toHaveLength(1);
    expect(pushIntents[0]).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 0, dy: 1 });
  });

  it('does not push caster', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    // Прыжок на соседнюю клетку — кастер попадал бы в радиус 1 от цели.
    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const pushIntents = intents.filter(i => i.type === 'PUSH').filter(i => i.entityId === player.id);

    expect(pushIntents).toHaveLength(0);
  });

  it('damages door in aoe via DAMAGE_TILE and pushes it', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ id: 'door_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const doorTileIntent = intents.find(
      i => i.type === 'DAMAGE_TILE' && i.position.x === 7 && i.position.y === 6
    );
    expect(doorTileIntent).toBeDefined();

    const builder = makeBuilder(player.id);
    executeIntent(state, doorTileIntent!, builder, builder.root);

    expect(door.hp).toBeLessThan(50);
  });

  it('returns no intents when target is a wall', () => {
    const state = makeGameState();
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 6 }]);
    expect(intents).toHaveLength(0);
  });

  it('returns no intents when target is occupied', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('executes full leap and push into empty cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(7);
    expect(enemy.hp).toBeLessThan(50);
  });

  it('pushes enemy into wall: enemy takes bump damage and is stunned', () => {
    const state = makeGameState();
    // Стена в клетке, куда враг отталкивается.
    state.map.tiles[7]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(6);
    expect(enemy.hp).toBeLessThan(50);
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(true);
  });
});
