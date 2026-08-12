import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import { makeDoor, makeEnemy, makeGameState, makePlayer, createTestTerrains } from '../../../fixtures/gameState';
import {createGroundSlamSkill} from '../../../../src/simulation/skills/executors/groundSlamSkill';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate} from '../../../../src/content/schemas';
import {getSkillExecutor} from '../../../../src/simulation/skills/skillExecutor';
import {initSkillRegistry} from '../../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'groundSlam',
    radius: 2,
    baseDamage: 12,
    cooldown: 4,
    apCost: 2,
    aiPreparable: true,
    damageTag: 'damage.physical.blunt',
    tags: ['delivery.ability', 'attack.melee', 'target.aoe'],
    ...overrides,
  } as AbilityTemplate;
}

/** Исполнитель ground_slam (радиус 2, урон 12), собранный фабрикой — как это делает getSkillExecutor из шаблона. */
const groundSlamSkill = createGroundSlamSkill({ id: 'ground_slam', radius: 2, baseDamage: 12 });

describe('groundSlamSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['ground_slam', mockAbility('ground_slam')],
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

  it('getSkillExecutor собирает исполнитель из шаблона (kind groundSlam)', () => {
    const executor = getSkillExecutor('ground_slam');

    expect(executor).toBeDefined();
    expect(executor!.id).toBe('ground_slam');

    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    expect(executor!.getTargetMode(state, player)).toEqual({ type: 'self' });
  });

  it('getValidTargets возвращает только клетку кастера', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    expect(groundSlamSkill.getValidTargets(state, player)).toEqual([{ x: 5, y: 5 }]);
  });

  it('getAffectedPositions возвращает квадрат 5×5 от актуальной позиции кастера', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const positions = groundSlamSkill.getAffectedPositions(state, player, [{ x: 5, y: 5 }], { x: 5, y: 5 });

    expect(positions).toHaveLength(25);
    expect(positions.some(p => p.x === 3 && p.y === 3)).toBe(true);
    expect(positions.some(p => p.x === 7 && p.y === 7)).toBe(true);
    expect(positions.some(p => p.x === 8 && p.y === 5)).toBe(false);
  });

  it('resolve бьёт всех damageable в радиусе 2, кроме кастера (friendly fire)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'ground_slam', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 7, hp: 50, maxHp: 50, armor: 0 });
    const friendly = makeEnemy({ id: 'enemy_2', x: 3, y: 5, hp: 30, maxHp: 30, armor: 0 });
    const door = makeDoor({ id: 'door_1', x: 5, y: 3, hp: 40, maxHp: 40, armor: 0 });
    const outOfRange = makeEnemy({ id: 'enemy_far', x: 8, y: 5, hp: 20, maxHp: 20, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.entities.set(friendly.id, friendly);
    state.entities.set(door.id, door);
    state.entities.set(outOfRange.id, outOfRange);

    const intents = groundSlamSkill.resolve(state, player, [{ x: 5, y: 5 }]);
    const damageIntents = intents.filter(i => i.type === 'DAMAGE');

    // Цели: два врага и дверь; кастер и враг вне радиуса не затронуты.
    expect(damageIntents).toHaveLength(3);
    expect(damageIntents.some(i => i.type === 'DAMAGE' && i.entityId === player.id)).toBe(false);
    expect(damageIntents.some(i => i.type === 'DAMAGE' && i.entityId === outOfRange.id)).toBe(false);

    for (const intent of damageIntents) {
      if (intent.type !== 'DAMAGE') continue;
      // Формула ground_slam — flat baseDamage.
      expect(intent.damage).toBe(12);
      expect(intent.tags).toContain('damage.physical.blunt');
      expect(intent.tags).toContain('skill.ground_slam');
      expect(intent.tags).toContain('target.aoe');
    }
  });

  it('resolve не возвращает интентов, если в радиусе нет целей', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'ground_slam', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    expect(groundSlamSkill.resolve(state, player, [{ x: 5, y: 5 }])).toHaveLength(0);
  });

  it('параметры шаблона задают радиус и урон (вариант с radius 1)', () => {
    const smallSlam = createGroundSlamSkill({ id: 'ground_slam', radius: 1, baseDamage: 5 });
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'ground_slam', source: 'innate', level: 1, currentCooldown: 0 }] });
    const near = makeEnemy({ id: 'enemy_near', x: 6, y: 6, hp: 50, maxHp: 50, armor: 0 });
    const far = makeEnemy({ id: 'enemy_far', x: 7, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(near.id, near);
    state.entities.set(far.id, far);

    const positions = smallSlam.getAffectedPositions(state, player, [{ x: 5, y: 5 }], { x: 5, y: 5 });
    expect(positions).toHaveLength(9);

    const damageIntents = smallSlam.resolve(state, player, [{ x: 5, y: 5 }]).filter(i => i.type === 'DAMAGE');
    expect(damageIntents).toHaveLength(1);
    expect(damageIntents[0]).toMatchObject({ type: 'DAMAGE', entityId: near.id, damage: 5 });
  });
});
