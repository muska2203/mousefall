import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  makeDoor,
  makeFloorItemContainer,
  makeStairs,
} from '../../../fixtures/gameState';
import { suddenStrikeSkill } from '../../../../src/simulation/skills/executors/suddenStrikeSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import type { EntityId } from '../../../../src/simulation/types';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    tags: [],
    ...overrides,
  } as AbilityTemplate;
}

describe('suddenStrikeSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['sudden_strike', mockAbility('sudden_strike', { cooldown: 2, apCost: 1, tags: ['attack.melee', 'target.single', 'delivery.weapon'] })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
    vi.restoreAllMocks();
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('sudden_strike')).toBeDefined();
  });

  it('getTargetMode returns single target with range 1', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    expect(suddenStrikeSkill.getTargetMode(state, player)).toEqual({ type: 'single', range: 1 });
  });

  it('getValidTargets returns only cells with alive combat actors, excluding caster', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_alive', x: 6, y: 5 });
    const deadEnemy = makeEnemy({ id: 'enemy_dead', x: 4, y: 5, isAlive: false });
    const door = makeDoor({ id: 'door_1', x: 5, y: 6 });
    const container = makeFloorItemContainer({ x: 5, y: 4 });
    const stairs = makeStairs('stairs_down', { x: 6, y: 6 });

    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.entities.set(deadEnemy.id, deadEnemy);
    state.entities.set(door.id, door);
    state.entities.set(container.id, container);
    state.entities.set(stairs.id, stairs);

    const targets = suddenStrikeSkill.getValidTargets(state, player);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ x: 6, y: 5 });
  });

  it('getValidTargets respects map boundaries in a corner', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 0, y: 0 });
    const enemy = makeEnemy({ id: 'enemy_corner', x: 1, y: 1 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const targets = suddenStrikeSkill.getValidTargets(state, player);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ x: 1, y: 1 });
  });

  it('resolve returns no intents when cast on empty tile', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 5, dex: 0, int: 0, vit: 0 } });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('resolve deals weapon-formula damage to target', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'sudden_strike', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_target', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    // Без оружия формула unarmed: max(0, round(1 + str * 1.0)) = 6.
    expect(damageIntents[0]!.damage).toBe(6);
    expect(damageIntents[0]!.tags).toContain('damage.physical.blunt');
  });

  it('resolve produces DAMAGE intent with correct melee single-target weapon tags', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const enemy = makeEnemy({ id: 'enemy_tags', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntent = intents.find(i => i.type === 'DAMAGE');

    expect(damageIntent).toBeDefined();
    expect(damageIntent!.type).toBe('DAMAGE');
    expect(damageIntent!.tags).toEqual([
      'damage.physical.blunt',
      'attack.melee',
      'target.single',
      'delivery.weapon',
      'delivery.unarmed',
    ]);
  });

  it('resolve applies silenced only when enemy has preparedAbility', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const enemy = makeEnemy({
      id: 'enemy_prepared',
      x: 6,
      y: 5,
      hp: 50,
      maxHp: 50,
      armor: 0,
      aiState: {
        strategy: 'hunter',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 6,
        homeY: 5,
        preparedAbility: { abilityId: 'fireball', targets: [{ x: 5, y: 5 }] },
      },
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(statusIntents).toHaveLength(1);
    expect(statusIntents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: { type: 'silenced', duration: 2, value: 0, statModifiers: null },
    });
  });

  it('resolve does not apply silenced when enemy has no preparedAbility', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const enemy = makeEnemy({
      id: 'enemy_unprepared',
      x: 6,
      y: 5,
      hp: 50,
      maxHp: 50,
      armor: 0,
      aiState: {
        strategy: 'hunter',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 6,
        homeY: 5,
        preparedAbility: null,
      },
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(intents.some(i => i.type === 'APPLY_STATUS')).toBe(false);
  });

  it('getAffectedPositions returns only the selected cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const positions = suddenStrikeSkill.getAffectedPositions(state, player, [], { x: 6, y: 5 });

    expect(positions).toEqual([{ x: 6, y: 5 }]);
  });

  it('preview delegates to resolve with hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    });
    const enemy = makeEnemy({ id: 'enemy_preview', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const previewIntents = suddenStrikeSkill.preview(state, player, [], { x: 6, y: 5 });
    const resolveIntents = suddenStrikeSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(previewIntents).toEqual(resolveIntents);
  });
});
