import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { makeGameState, makePlayer, makeEnemy, makeDoor } from '../../../fixtures/gameState';
import { magicSlapSkill } from '../../../../src/simulation/skills/executors/magicSlapSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    ...overrides,
  } as AbilityTemplate;
}

describe('magicSlapSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['magic_slap', mockAbility('magic_slap', { cooldown: 2 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('deals damage 3 times to same target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = magicSlapSkill.resolve(state, player, [
      { x: 6, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 5 },
    ]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(3);
    expect(damageIntents.every(i => i.entityId === enemy.id)).toBe(true);
    expect(damageIntents.every(i => i.damageType === 'electric')).toBe(true);
  });

  it('deals damage to 3 different targets', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy1 = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100 });
    const enemy2 = makeEnemy({ id: 'enemy_2', x: 7, y: 5, hp: 100, maxHp: 100 });
    const enemy3 = makeEnemy({ id: 'enemy_3', x: 8, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy1.id, enemy1);
    state.entities.set(enemy2.id, enemy2);
    state.entities.set(enemy3.id, enemy3);

    const intents = magicSlapSkill.resolve(state, player, [
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 8, y: 5 },
    ]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(3);
    expect(damageIntents[0]!.entityId).toBe(enemy1.id);
    expect(damageIntents[1]!.entityId).toBe(enemy2.id);
    expect(damageIntents[2]!.entityId).toBe(enemy3.id);
  });

  it('deals damage to door', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, baseStats: { str: 0, dex: 0, int: 10, vit: 0 }, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5, hp: 100, maxHp: 100, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = magicSlapSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(door.id);
    expect(damageIntents[0]!.damageType).toBe('electric');
  });

  it('can target enemy in line of sight', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ x: 7, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const validTargets = magicSlapSkill.getValidTargets(state, player);
    expect(validTargets.some(p => p.x === 7 && p.y === 5)).toBe(true);
  });

  it('cannot target enemy behind a closed door', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ x: 6, y: 5 });
    const enemy = makeEnemy({ x: 7, y: 5, hp: 100, maxHp: 100 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);
    state.entities.set(enemy.id, enemy);

    const validTargets = magicSlapSkill.getValidTargets(state, player);
    expect(validTargets.some(p => p.x === 7 && p.y === 5)).toBe(false);
  });
});
