import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeDoor, makeEnemy, makeGameState, makePlayer, createTestTerrains} from '../../../fixtures/gameState';
import {createThrowSkill} from '../../../../src/simulation/skills/executors/throwSkill';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate} from '../../../../src/content/schemas';
import {getSkillExecutor} from '../../../../src/simulation/skills/skillExecutor';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'throw',
    range: 4,
    baseDamage: 6,
    pushDistance: 1,
    cooldown: 2,
    apCost: 1,
    aiPreparable: false,
    damageTag: 'damage.physical.blunt',
    tags: ['delivery.ability', 'attack.ranged', 'target.single', 'delivery.projectile'],
    ...overrides,
  } as AbilityTemplate;
}

/** Исполнитель stone_throw (дальность 4, урон 6, толчок 1), собранный фабрикой — как это делает getSkillExecutor из шаблона. */
const throwSkill = createThrowSkill({ id: 'stone_throw', range: 4, baseDamage: 6, pushDistance: 1 });

describe('throwSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['stone_throw', mockAbility('stone_throw')],
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

  it('getSkillExecutor собирает исполнитель из шаблона (kind throw)', () => {
    const executor = getSkillExecutor('stone_throw');

    expect(executor).toBeDefined();
    expect(executor!.id).toBe('stone_throw');

    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    expect(executor!.getTargetMode(state, player)).toEqual({ type: 'single', range: 4 });
  });

  it('getValidTargets возвращает damageable-цели на 8 лучах в радиусе и в прямой видимости', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const near = makeEnemy({ id: 'enemy_near', x: 5, y: 3, hp: 30, maxHp: 30, armor: 0 });
    // На диагональном луче — тоже валидная цель.
    const diagonal = makeEnemy({ id: 'enemy_diag', x: 8, y: 2, hp: 30, maxHp: 30, armor: 0 });
    // Чебышёвская дистанция 5 — вне range 4.
    const far = makeEnemy({ id: 'enemy_far', x: 9, y: 0, hp: 30, maxHp: 30, armor: 0 });
    // Дистанция 3 и в LOS, но не на луче (dx=3, dy=1) — невалидна при 8-лучевом таргетинге.
    const offRay = makeEnemy({ id: 'enemy_off_ray', x: 8, y: 6, hp: 30, maxHp: 30, armor: 0 });
    // За закрытой дверью на одной линии с кастером — LOS заблокирован.
    const door = makeDoor({ id: 'door_1', x: 6, y: 5 });
    const behindDoor = makeEnemy({ id: 'enemy_hidden', x: 7, y: 5, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(near.id, near);
    state.entities.set(diagonal.id, diagonal);
    state.entities.set(far.id, far);
    state.entities.set(offRay.id, offRay);
    state.entities.set(door.id, door);
    state.entities.set(behindDoor.id, behindDoor);

    const targets = throwSkill.getValidTargets(state, player);

    expect(targets.some(p => p.x === 5 && p.y === 3)).toBe(true);
    expect(targets.some(p => p.x === 8 && p.y === 2)).toBe(true);
    expect(targets.some(p => p.x === 9 && p.y === 0)).toBe(false);
    expect(targets.some(p => p.x === 8 && p.y === 6)).toBe(false);
    expect(targets.some(p => p.x === 7 && p.y === 5)).toBe(false);
    // Кастер не входит в список целей.
    expect(targets.some(p => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('getCastableCells возвращает все видимые клетки на 8 лучах независимо от наличия целей', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    // За закрытой дверью на одной линии с кастером — LOS заблокирован.
    const door = makeDoor({ id: 'door_1', x: 6, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const cells = throwSkill.getCastableCells!(state, player);

    // Пустые клетки лучей входят в паттерн, цели не требуются.
    expect(cells.some(p => p.x === 5 && p.y === 3)).toBe(true);
    expect(cells.some(p => p.x === 8 && p.y === 2)).toBe(true);
    // Клетка вне луча (dx=3, dy=1) не входит.
    expect(cells.some(p => p.x === 8 && p.y === 6)).toBe(false);
    // Клетка луча за закрытой дверью не видна — не входит.
    expect(cells.some(p => p.x === 7 && p.y === 5)).toBe(false);
    // Клетка кастера не входит.
    expect(cells.some(p => p.x === 5 && p.y === 5)).toBe(false);
    // Все клетки паттерна лежат на лучах и в пределах range.
    for (const p of cells) {
      const dx = p.x - 5;
      const dy = p.y - 5;
      expect(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)).toBe(true);
      expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeLessThanOrEqual(4);
    }
  });

  it('resolve возвращает DAMAGE с уроном и тегами шаблона + один PUSH в направлении от кастера', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = throwSkill.resolve(state, player, [{ x: 7, y: 5 }]);

    expect(intents).toHaveLength(2);
    const damage = intents.find(i => i.type === 'DAMAGE');
    expect(damage).toMatchObject({
      type: 'DAMAGE',
      entityId: enemy.id,
      sourceEntityId: player.id,
      damage: 6,
    });
    expect(damage!.tags).toContain('damage.physical.blunt');
    expect(damage!.tags).toContain('attack.ranged');
    expect(damage!.tags).toContain('target.single');

    const pushes = intents.filter(i => i.type === 'PUSH');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      type: 'PUSH',
      entityId: enemy.id,
      dx: 1,
      dy: 0,
      sourceEntityId: player.id,
    });
  });

  it('resolve по диагональной цели толкает по диагонали (sign от кастера)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 7, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = throwSkill.resolve(state, player, [{ x: 7, y: 7 }]);
    const pushes = intents.filter(i => i.type === 'PUSH');

    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 1, dy: 1 });
  });

  it('resolve при pushDistance 0 возвращает только DAMAGE', () => {
    const noPush = createThrowSkill({ id: 'stone_throw', range: 4, baseDamage: 6, pushDistance: 0 });
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = noPush.resolve(state, player, [{ x: 7, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'DAMAGE', entityId: enemy.id, damage: 6 });
  });

  it('resolve по клетке без damageable-цели не возвращает интентов', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    expect(throwSkill.resolve(state, player, [{ x: 7, y: 5 }])).toHaveLength(0);
    expect(throwSkill.resolve(state, player, [])).toHaveLength(0);
  });

  it('getAffectedPositions возвращает клетку цели и траекторию толчка за ней', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const positions = throwSkill.getAffectedPositions(state, player, [], { x: 7, y: 5 });

    expect(positions).toEqual([{ x: 7, y: 5 }, { x: 8, y: 5 }]);
    expect(throwSkill.getAffectedPositions(state, player, [], null)).toEqual([]);
  });

  it('preview по наведённой цели повторяет resolve, без наведения — пусто', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    expect(throwSkill.preview(state, player, [], null)).toHaveLength(0);

    const intents = throwSkill.preview(state, player, [], { x: 7, y: 5 });
    expect(intents).toHaveLength(2);
    expect(intents.filter(i => i.type === 'DAMAGE')).toHaveLength(1);
    expect(intents.filter(i => i.type === 'PUSH')).toHaveLength(1);
  });

  it('параметры шаблона задают дальность, урон и дистанцию толчка (вариант с pushDistance 2)', () => {
    const heavyThrow = createThrowSkill({ id: 'stone_throw', range: 2, baseDamage: 3, pushDistance: 2 });
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 30, maxHp: 30, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    expect(heavyThrow.getTargetMode(state, player)).toEqual({ type: 'single', range: 2 });

    const intents = heavyThrow.resolve(state, player, [{ x: 6, y: 5 }]);
    const damage = intents.find(i => i.type === 'DAMAGE');
    const pushes = intents.filter(i => i.type === 'PUSH');

    expect(damage).toMatchObject({ type: 'DAMAGE', entityId: enemy.id, damage: 3 });
    expect(pushes).toHaveLength(2);
    for (const push of pushes) {
      expect(push).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 1, dy: 0 });
    }

    const positions = heavyThrow.getAffectedPositions(state, player, [], { x: 6, y: 5 });
    expect(positions).toEqual([{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }]);
  });
});
