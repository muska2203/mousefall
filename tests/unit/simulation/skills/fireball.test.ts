import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
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
    name: id,
    description: 'test',
    symbol: '*',
    spriteId: id,
    targetType: 'ranged',
    range: 5,
    aoeRadius: 1,
    cooldown: 3,
    mpCost: 10,
    effect: { type: 'damage', value: 20, statusType: 'burning', duration: 3 },
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
        ['fireball', mockAbility('fireball', { mpCost: 10, cooldown: 3 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('resolves no intents when cast on empty tile', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[6]![6] = true;
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    expect(intents).toHaveLength(0);
  });

  it('deals center damage + burning to enemy in center', () => {
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

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.damage).toBeGreaterThan(0);
    expect(statusIntents).toHaveLength(1);
    expect(statusIntents[0]!.status.type).toBe('burning');
    expect(statusIntents[0]!.status.duration).toBe(3);
  });

  it('deals aoe damage + burning to enemy near center', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[6]![6] = true;
    state.visible[7]![6] = true;
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 7, y: 6, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = fireballSkill.resolve(state, player, [{ x: 6, y: 6 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
  });

  it('hits multiple enemies in aoe', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[6]![6] = true;
    state.visible[7]![6] = true;
    state.visible[6]![7] = true;
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }] });
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

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('fireball')).toBeDefined();
  });
});
