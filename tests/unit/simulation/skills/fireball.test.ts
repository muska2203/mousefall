import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { fireballSkill } from '../../../../src/simulation/skills/executors/fireballSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate, LoadedContent, TileEffectTemplate, TileEffectStatusTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';

vi.mock('../../../../src/utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

import { rngChance } from '../../../../src/utils/rng';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 3,
    tags: ['delivery.ability', 'attack.ranged', 'target.aoe', 'delivery.projectile', 'delivery.spell', 'effect.burn'],
    ...overrides,
  } as AbilityTemplate;
}

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & { id: string }): TileEffectTemplate {
  return {
    layer: 'cover',
    duration: 4,
    renderOrder: 1,
    ruleIds: ['fire_damage_ignites_oil', 'fire_tile_damage_ignites_oil'],
    blockedByTileEffects: [],
    mutuallyExclusiveWithTileEffects: [],
    canHaveStatus: ['burning'],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function mockTileEffectStatusTemplate(
  overrides: Partial<TileEffectStatusTemplate> & { id: string },
): TileEffectStatusTemplate {
  return {
    duration: 3,
    neverExpires: false,
    ruleIds: [],
    statusCategory: 'elemental',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    renderOrder: 10,
    ...overrides,
  };
}

function createContentWithOilAndBurning(): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map([
      ['fireball', mockAbility('fireball', { cooldown: 3 })],
    ]),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map([
      ['oil', mockTileEffectTemplate({ id: 'oil', canHaveStatus: ['burning'] })],
    ]),
    tileEffectStatuses: new Map([
      ['burning', mockTileEffectStatusTemplate({ id: 'burning' })],
    ]),
  };
}

function placeOil(state: ReturnType<typeof makeGameState>, x: number, y: number) {
  state.tileEffects[y]![x]!.oil = {
    type: 'oil',
    duration: 5,
    layer: 'cover',
    statusEffects: [],
    renderOrder: 1,
  };
}

describe('fireballSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { cooldown: 3 })],
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

  it('resolves DAMAGE_TILE intents for all positions in aoe', () => {
    const state = makeGameState();
    state.visible[3]![3] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 3, y: 3, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');

    expect(damageTileIntents).toHaveLength(9);
    expect(damageTileIntents.every(i => i.tags.includes('damage.magical.fire'))).toBe(true);
    expect(damageTileIntents.every(i => i.tags.includes('target.aoe'))).toBe(true);
  });

  it('center tile deals more damage than aoe tiles', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const centerIntent = intents.find((i): i is Extract<typeof i, { type: 'DAMAGE_TILE' }> => i.type === 'DAMAGE_TILE' && i.position.x === 6 && i.position.y === 6);
    const aoeIntent = intents.find((i): i is Extract<typeof i, { type: 'DAMAGE_TILE' }> => i.type === 'DAMAGE_TILE' && i.position.x === 7 && i.position.y === 6);

    expect(centerIntent).toBeDefined();
    expect(aoeIntent).toBeDefined();
    expect(centerIntent!.damage).toBeGreaterThan(aoeIntent!.damage);
  });

  it('executing DAMAGE_TILE damages entities in affected tiles', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const centerIntent = intents.find(i => i.type === 'DAMAGE_TILE' && i.position.x === 6 && i.position.y === 6);
    expect(centerIntent).toBeDefined();

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'fireball', targets: [{ x: 6, y: 6 }] },
    });

    executeIntent(state, centerIntent!, builder, builder.root);

    expect(enemy.hp).toBeLessThan(100);
  });

  it('executing DAMAGE_TILE emits TILE_DAMAGED event', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const centerIntent = intents.find(i => i.type === 'DAMAGE_TILE' && i.position.x === 6 && i.position.y === 6);
    expect(centerIntent).toBeDefined();

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'fireball', targets: [{ x: 6, y: 6 }] },
    });

    executeIntent(state, centerIntent!, builder, builder.root);

    const tileDamagedEvent = builder.root.children.find(e => e.event.type === 'TILE_DAMAGED');
    expect(tileDamagedEvent).toBeDefined();
    expect(tileDamagedEvent!.event).toMatchObject({
      type: 'TILE_DAMAGED',
      position: { x: 6, y: 6 },
    });
  });

  it('can target tile with enemy in line of sight', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 7, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const validTargets = fireballSkill.getValidTargets(state, player);
    expect(validTargets.some(p => p.x === 7 && p.y === 5)).toBe(true);
  });

  it('cannot target enemy behind a closed door', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5 });
    const enemy = makeEnemy({ x: 7, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);
    state.entities.set(enemy.id, enemy);

    const validTargets = fireballSkill.getValidTargets(state, player);
    expect(validTargets.some(p => p.x === 7 && p.y === 5)).toBe(false);
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('fireball')).toBeDefined();
  });

  it('resolve returns DAMAGE_TILE intents, no direct status application', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(damageTileIntents).toHaveLength(9);
    expect(statusIntents).toHaveLength(0);
  });

  it('TILE_DAMAGED ignites oil on empty tile', () => {
    resetRegistry();
    initRegistry(createContentWithOilAndBurning());
    vi.mocked(rngChance).mockReturnValue(true);

    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);
    placeOil(state, 6, 6);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const centerIntent = intents.find(i => i.type === 'DAMAGE_TILE' && i.position.x === 6 && i.position.y === 6);
    expect(centerIntent).toBeDefined();

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'fireball', targets: [{ x: 6, y: 6 }] },
    });

    executeIntent(state, centerIntent!, builder, builder.root);

    const oil = state.tileEffects[6]![6]!.oil;
    expect(oil).toBeDefined();
    const burning = oil!.statusEffects.find(s => s.type === 'burning');
    expect(burning).toBeDefined();
    expect(burning!.duration).toBe(3);

    resetRegistry();
  });

  it('TILE_DAMAGED ignites oil when entity stands on it', () => {
    resetRegistry();
    initRegistry(createContentWithOilAndBurning());
    vi.mocked(rngChance).mockReturnValue(true);

    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 0, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    placeOil(state, 6, 6);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const centerIntent = intents.find(i => i.type === 'DAMAGE_TILE' && i.position.x === 6 && i.position.y === 6);
    expect(centerIntent).toBeDefined();

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'USE_ABILITY', entityId: player.id, abilityId: 'fireball', targets: [{ x: 6, y: 6 }] },
    });

    executeIntent(state, centerIntent!, builder, builder.root);

    const oil = state.tileEffects[6]![6]!.oil;
    expect(oil).toBeDefined();
    const burning = oil!.statusEffects.find(s => s.type === 'burning');
    expect(burning).toBeDefined();

    resetRegistry();
  });
});
