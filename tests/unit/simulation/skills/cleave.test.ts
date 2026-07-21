import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  makeDoor,
  makeFloorItemContainer,
  makeStairs,
} from '../../../fixtures/gameState';
import { cleaveSkill } from '../../../../src/simulation/skills/executors/cleaveSkill';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate, ItemTemplate } from '../../../../src/content/schemas';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    damageTag: 'damage.physical.slashing',
    ...overrides,
  } as AbilityTemplate;
}

const mockSword: ItemTemplate = {
  id: 'mock_sword',
  type: 'weapon',
  value: 10,
  rarity: 'common',
  stackable: false,
  maxStack: 1,
  equipModifiers: [],
  abilityPool: [],
  grantedAbilities: [],
  ruleIds: [],
  apCost: 1,
  weapon: {
    baseDamage: 4,
    damageFormulaId: 'sword',
    range: 1,
    damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
};

describe('cleaveSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['mock_sword', mockSword],
      ]),
      abilities: new Map([
        ['cleave', mockAbility('cleave', { cooldown: 2, apCost: 1 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('is registered in skill registry', () => {
    expect(getSkillExecutor('cleave')).toBeDefined();
  });

  it('getValidTargets returns exactly 8 neighboring cells excluding caster and staying inside map', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const targets = cleaveSkill.getValidTargets(state, player);

    expect(targets).toHaveLength(8);
    expect(targets.some(p => p.x === 5 && p.y === 5)).toBe(false);
    expect(targets.every(p => p.x >= 0 && p.x < state.map.width && p.y >= 0 && p.y < state.map.height)).toBe(true);
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(true);
    expect(targets.some(p => p.x === 4 && p.y === 4)).toBe(true);
  });

  it('getValidTargets respects map boundaries in a corner', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 0, y: 0 });

    const targets = cleaveSkill.getValidTargets(state, player);

    expect(targets).toHaveLength(3);
    expect(targets.some(p => p.x === 0 && p.y === 0)).toBe(false);
    expect(targets.every(p => p.x >= 0 && p.x < state.map.width && p.y >= 0 && p.y < state.map.height)).toBe(true);
  });

  it('getAffectedPositions returns correct 3-cell arc for each of 8 directions', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const cases: Array<{ target: { x: number; y: number }; expected: Array<{ x: number; y: number }> }> = [
      { target: { x: 6, y: 5 }, expected: [{ x: 6, y: 5 }, { x: 6, y: 6 }, { x: 6, y: 4 }] },
      { target: { x: 4, y: 5 }, expected: [{ x: 4, y: 5 }, { x: 4, y: 6 }, { x: 4, y: 4 }] },
      { target: { x: 5, y: 6 }, expected: [{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 4, y: 6 }] },
      { target: { x: 5, y: 4 }, expected: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 4, y: 4 }] },
      { target: { x: 6, y: 6 }, expected: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 5 }] },
      { target: { x: 6, y: 4 }, expected: [{ x: 6, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 5 }] },
      { target: { x: 4, y: 6 }, expected: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 5 }] },
      { target: { x: 4, y: 4 }, expected: [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }] },
    ];

    for (const { target, expected } of cases) {
      const positions = cleaveSkill.getAffectedPositions(state, player, [], target);
      expect(positions).toHaveLength(3);
      for (const pos of expected) {
        expect(positions.some(p => p.x === pos.x && p.y === pos.y)).toBe(true);
      }
    }
  });

  it('resolve returns no intents when cast on empty tile', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('resolve deals damage to a single target in center cell', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      equippedWeaponId: 'mock_sword',
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_center', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(enemy.id);
    expect(damageIntents[0]!.damage).toBeGreaterThan(0);
    expect(damageIntents[0]!.tags).toContain('damage.physical.slashing');
  });

  it('resolve deals damage to two targets in arc', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemyCenter = makeEnemy({ id: 'enemy_center', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    const enemySide = makeEnemy({ id: 'enemy_side', x: 6, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemyCenter.id, enemyCenter);
    state.entities.set(enemySide.id, enemySide);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(2);
    expect(damageIntents.some(i => i.entityId === enemyCenter.id)).toBe(true);
    expect(damageIntents.some(i => i.entityId === enemySide.id)).toBe(true);
  });

  it('resolve deals damage to three targets in arc', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemyCenter = makeEnemy({ id: 'enemy_center', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    const enemySide1 = makeEnemy({ id: 'enemy_side1', x: 6, y: 6, hp: 50, maxHp: 50, armor: 0 });
    const enemySide2 = makeEnemy({ id: 'enemy_side2', x: 6, y: 4, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemyCenter.id, enemyCenter);
    state.entities.set(enemySide1.id, enemySide1);
    state.entities.set(enemySide2.id, enemySide2);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(3);
    expect(damageIntents.some(i => i.entityId === enemyCenter.id)).toBe(true);
    expect(damageIntents.some(i => i.entityId === enemySide1.id)).toBe(true);
    expect(damageIntents.some(i => i.entityId === enemySide2.id)).toBe(true);
  });

  it('resolve damages door but not floor container or stairs', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      equippedWeaponId: 'mock_sword',
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const door = makeDoor({ id: 'door_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    const container = makeFloorItemContainer({ x: 6, y: 6 });
    const stairs = makeStairs('stairs_down', { x: 6, y: 4 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);
    state.entities.set(container.id, container);
    state.entities.set(stairs.id, stairs);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.entityId).toBe(door.id);
    expect(damageIntents[0]!.damage).toBeGreaterThan(0);
    expect(damageIntents.some(i => i.entityId === container.id)).toBe(false);
    expect(damageIntents.some(i => i.entityId === stairs.id)).toBe(false);
  });

  it('resolve does not create COUNTER_ATTACK intents', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(intents.some(i => i.type === 'COUNTER_ATTACK')).toBe(false);
  });

  it('использует damageTag из JSON и не падает без него с fallback', () => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['mock_sword', mockSword],
      ]),
      abilities: new Map([
        ['cleave', mockAbility('cleave', { damageTag: undefined })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      equippedWeaponId: 'mock_sword',
      abilities: [{ templateId: 'cleave', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = cleaveSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]!.tags).toContain('damage.physical.slashing');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('damageTag'));

    warnSpy.mockRestore();
  });
});
