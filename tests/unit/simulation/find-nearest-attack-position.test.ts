/**
 * Тесты GameSimulation.findNearestAttackPosition — поиска ближайшей
 * к игроку атакующей клетки для базовой атаки по цели.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate } from '@content/schemas';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  createTestTerrains,
} from '../../fixtures/gameState.ts';
import { createTestSimulation } from '../../helpers/simulation.ts';
import type { Entity, EntityId, Position } from '../../../src/simulation/types';

function mockWeapon(
  id: string,
  overrides: { range?: number; minRange?: number } = {},
): ItemTemplate {
  return {
    id,
    name: id,
    type: 'weapon',
    subtype: 'sword',
    level: 1,
    rarity: 'common',
    stackable: false,
    maxStack: 1,
    value: 0,
    abilityPool: [],
    grantedAbilities: [],
    fixedModifiers: [],
    apCost: 1,
    weapon: {
      damage: { min: 4, max: 6 },
      range: overrides.range ?? 1,
      minRange: overrides.minRange ?? 1,
      damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    },
  } as ItemTemplate;
}

/** Рукопашное оружие 1/1. */
const SWORD = mockWeapon('test_sword');
/** Дальнобойная праща 5/2 (аналог common_sling). */
const SLING = mockWeapon('test_sling', { range: 5, minRange: 2 });

function makePlayerWithWeapon(weaponId: string, overrides: Parameters<typeof makePlayer>[0] = {}) {
  return makePlayer({
    x: 5,
    y: 5,
    equippedWeaponId: weaponId,
    equippedWeaponInstanceId: `${weaponId}_1`,
    inventory: [
      { instanceId: `${weaponId}_1`, templateId: weaponId, quantity: 1, grantedAbilities: [], affixes: [] },
    ],
    ...overrides,
  });
}

function makeStateWith(player: ReturnType<typeof makePlayer>, entities: Entity[] = []) {
  const map = new Map<EntityId, Entity>([[player.id, player]]);
  for (const entity of entities) {
    map.set(entity.id, entity);
  }
  return makeGameState({ player, entities: map });
}

describe('GameSimulation.findNearestAttackPosition', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map([
        [SWORD.id, SWORD],
        [SLING.id, SLING],
      ]),
      abilities: new Map(),
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

  it('melee: возвращает визуально ближайшую соседнюю с целью клетку и путь до неё', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5 });
    const state = makeStateWith(player, [enemy]);
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 7, y: 5 });

    expect(result).not.toBeNull();
    // Три кандидата с путём длины 1: (6,4), (6,5), (6,6) — выигрывает
    // визуально ближайшая к игроку (6,5) (евклидова дистанция 1 против √2).
    expect(result!.position).toEqual({ x: 6, y: 5 });
    expect(result!.path).toHaveLength(1);
    const last: Position = result!.path[result!.path.length - 1]!;
    expect(last).toEqual(result!.position);
  });

  it('melee: игрок уже на атакующей клетке — пустой путь', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 6, y: 5 });

    expect(result).toEqual({ position: { x: 5, y: 5 }, path: [] });
  });

  it('melee: визуально ближайшая клетка занята видимым врагом — выбирается следующая', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5 });
    const blocker = makeEnemy({ id: 'enemy_2', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy, blocker]);
    // Кандидат (6,5) занят видимым блокиратором — непроходим.
    state.visible[5]![6] = true;
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 7, y: 5 });

    expect(result).not.toBeNull();
    // Следующие по визуальной близости — (6,4) и (6,6) (дистанция √2,
    // путь длины 1); тай-брейк по координатам (y, x) выбирает (6,4).
    expect(result!.position).toEqual({ x: 6, y: 4 });
  });

  it('melee: визуально ближайшая клетка в приоритете над более коротким путём', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 8, y: 5 });
    const state = makeStateWith(player, [enemy]);
    // Стена перекрывает прямой проход: путь к (7,5) огибает её (5 шагов),
    // путь к (7,4) короче (4 шага) — но (7,5) визуально ближе к игроку.
    for (const wy of [4, 5, 6]) {
      state.map.tiles[wy]![6] = 'wall';
    }
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 8, y: 5 });

    expect(result).not.toBeNull();
    expect(result!.position).toEqual({ x: 7, y: 5 });
  });

  it('melee: при равной визуальной дистанции выигрывает кратчайший путь', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 8, y: 5 });
    const state = makeStateWith(player, [enemy]);
    // (7,5) выбывает из кандидатов (стена). Остаются симметричные (7,4) и (7,6)
    // с равной евклидовой дистанцией от игрока (5,5); стены делают путь
    // к (7,6) длиннее (3 шага через низ против 2 шагов напрямую).
    state.map.tiles[5]![7] = 'wall';
    state.map.tiles[5]![6] = 'wall';
    state.map.tiles[6]![6] = 'wall';
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 8, y: 5 });

    expect(result).not.toBeNull();
    expect(result!.position).toEqual({ x: 7, y: 4 });
    expect(result!.path).toHaveLength(2);
  });

  it('ranged 5/2: цель вне зоны — атакующая клетка на краю зоны от цели', () => {
    // Игрок (2,5), цель (8,5): cheb 6 > range 5 — из текущей позиции не достать.
    const player = makePlayerWithWeapon(SLING.id, { x: 2, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 8, y: 5 });
    const state = makeStateWith(player, [enemy]);
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 8, y: 5 });

    expect(result).not.toBeNull();
    // Ближайшие к игроку кандидаты зоны [2,5] от цели — (3,4), (3,5), (3,6)
    // с путём длины 1; визуально ближайшая (3,5) (прямо по курсу) выигрывает.
    // Клетка впритык к врагу ближе minRange и не рассматривается.
    expect(result!.position).toEqual({ x: 3, y: 5 });
    expect(result!.path).toEqual([{ x: 3, y: 5 }]);
  });

  it('ranged 5/2: цель вплотную (ближе minRange) — игрок должен отойти', () => {
    const player = makePlayerWithWeapon(SLING.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);
    const sim = createTestSimulation(state);

    const result = sim.findNearestAttackPosition({ x: 6, y: 5 });

    expect(result).not.toBeNull();
    // Текущая позиция слишком близко (cheb 1 < minRange 2): ищется отступ.
    expect(result!.position).not.toEqual({ x: 5, y: 5 });
    expect(result!.path.length).toBeGreaterThan(0);
    const cheb = Math.max(
      Math.abs(result!.position.x - 6),
      Math.abs(result!.position.y - 5),
    );
    expect(cheb).toBeGreaterThanOrEqual(2);
    expect(cheb).toBeLessThanOrEqual(5);
  });

  it('возвращает null, если у всех кандидатов нет прямой видимости на цель', () => {
    const player = makePlayerWithWeapon(SLING.id);
    // Цель в глухой коробке 3×3 из стен: любой луч внутрь пересекает стену.
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 2 });
    const state = makeStateWith(player, [enemy]);
    for (const [wx, wy] of [
      [6, 1], [7, 1], [8, 1],
      [6, 2], [8, 2],
      [6, 3], [7, 3], [8, 3],
    ]) {
      state.map.tiles[wy!]![wx!] = 'wall';
    }
    const sim = createTestSimulation(state);

    expect(sim.findNearestAttackPosition({ x: 7, y: 2 })).toBeNull();
  });

  it('возвращает null, если цель недостижима (стена перекрывает карту)', () => {
    const player = makePlayerWithWeapon(SWORD.id);
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5 });
    const state = makeStateWith(player, [enemy]);
    // Сплошная стена-колонна x=6 по всей высоте интерьера.
    for (let y = 1; y <= 8; y++) {
      state.map.tiles[y]![6] = 'wall';
    }
    const sim = createTestSimulation(state);

    expect(sim.findNearestAttackPosition({ x: 7, y: 5 })).toBeNull();
  });
});
