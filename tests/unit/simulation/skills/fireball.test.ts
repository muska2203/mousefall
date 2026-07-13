import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { fireballSkill } from '../../../../src/simulation/skills/executors/fireballSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 3,
    ...overrides,
  } as AbilityTemplate;
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
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('resolves no intents when cast on empty tile', () => {
    const state = makeGameState();
    state.visible[3]![3] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 3, y: 3, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    expect(intents).toHaveLength(0);
  });

  it('deals center damage + burning to enemy in center', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.damage).toBeGreaterThan(0);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    expect(damageIntents[0]!.tags).toContain('damage.magical.fire');
    expect(statusIntents).toHaveLength(1);
    expect(statusIntents[0]!.status.type).toBe('burning');
    expect(statusIntents[0]!.status.duration).toBe(3);
  });

  it('deals aoe damage + burning to enemy near center', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    state.visible[7]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 7, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    expect(damageIntents[0]!.tags).toContain('damage.magical.fire');
  });

  it('hits multiple enemies in aoe', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    state.visible[7]![6] = true;
    state.visible[6]![7] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 6, y: 6, hp: 100, maxHp: 100 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 7, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(2);
  });

  it('damages caster when caster is inside aoe radius', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(damageIntents).toHaveLength(2);
    expect(damageIntents.some(i => i.entityId === player.id)).toBe(true);
    expect(damageIntents.some(i => i.entityId === enemy.id)).toBe(true);
    expect(statusIntents).toHaveLength(2);
    expect(statusIntents.some(i => i.entityId === player.id && i.status.type === 'burning')).toBe(true);
    expect(statusIntents.some(i => i.entityId === enemy.id && i.status.type === 'burning')).toBe(true);
  });

  it('deals center damage + burning to door', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 6, hp: 100, maxHp: 100, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(door.id);
    expect(damageIntents[0]!.tags).toContain('damage.magical.fire');
    expect(statusIntents).toHaveLength(1);
    expect(statusIntents[0]!.entityId).toBe(door.id);
    expect(statusIntents[0]!.status.type).toBe('burning');
  });

  it('deals aoe damage + burning to door near center', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    state.visible[7]![6] = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 7, y: 6, hp: 100, maxHp: 100, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(door.id);
    expect(damageIntents[0]!.tags).toContain('damage.magical.fire');
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

  it('does not apply burning status when content rules are enabled', () => {
    const state = makeGameState();
    state.visible[8]![8] = true;
    state.visible[6]![6] = true;
    state.featureFlags.contentRulesEnabled = true;
    const player = makePlayer({ x: 8, y: 8, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    const statusIntents = intents.filter(i => i.type === 'APPLY_STATUS');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    expect(damageIntents[0]!.tags).toContain('damage.magical.fire');
    expect(statusIntents).toHaveLength(0);
  });
});
