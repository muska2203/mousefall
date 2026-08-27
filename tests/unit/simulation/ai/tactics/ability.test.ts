/**
 * Unit-тесты тактики findCollisionLanding — выбор точки применения способности,
 * при которой толчок цели заканчивается столкновением с препятствием.
 *
 * Используется синтетический шаблон способности вида swoop (jumpRadius 3,
 * aoeRadius 1) — независимость от балансных данных реального контента.
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {findCollisionLanding} from '@simulation/ai/tactics';
import {initRegistry, resetRegistry} from '@content/registry';
import type {AbilityTemplate} from '@content/schemas';
import {createObjectContent, makeDoor, makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../../../fixtures/gameState';
import type {EnemyEntity, Entity, EntityId, GameState, PlayerEntity} from '@simulation/types';

const TEST_SWOOP_ID = 'test_collision_swoop';

function mockSwoopAbility(): AbilityTemplate {
  return {
    id: TEST_SWOOP_ID,
    kind: 'swoop',
    jumpRadius: 3,
    aoeRadius: 1,
    baseDamage: 10,
    cooldown: 2,
    apCost: 2,
    aiPreparable: true,
    tags: ['delivery.ability', 'delivery.movement', 'attack.melee', 'target.aoe', 'effect.knockback'],
  } as AbilityTemplate;
}

beforeEach(() => {
  resetRegistry();
  initRegistry(createObjectContent({
    abilities: new Map([[TEST_SWOOP_ID, mockSwoopAbility()]]),
  }));
});

/** Собирает состояние: карта 10×10 (стены по периметру), босс и игрок, доп. сущности. */
function setup(
  boss: {x: number; y: number},
  player: {x: number; y: number},
  extraEntities: Entity[] = [],
): {state: GameState; boss: EnemyEntity; player: PlayerEntity} {
  const bossEntity = makeEnemy({id: 'boss_test', x: boss.x, y: boss.y});
  const playerEntity = makePlayer({x: player.x, y: player.y});
  const entities = new Map<EntityId, Entity>([
    [playerEntity.id, playerEntity],
    [bossEntity.id, bossEntity],
    ...extraEntities.map((e): [EntityId, Entity] => [e.id, e]),
  ]);
  const state = makeGameState({player: playerEntity, entities});
  return {state, boss: bossEntity, player: playerEntity};
}

describe('findCollisionLanding', () => {
  it('находит точку приземления, дающую столкновение со стеной за целью', () => {
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5});
    // Стена сразу за игроком.
    state.map.tiles[5]![8] = 'wall';

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toEqual({x: 6, y: 5});
  });

  it('находит точку, дающую столкновение с другим актором за целью', () => {
    const blocker = makeEnemy({id: 'blocker_8_5', x: 8, y: 5});
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5}, [blocker]);

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toEqual({x: 6, y: 5});
  });

  it('находит точку, дающую столкновение с блокирующим объектом за целью', () => {
    const door = makeDoor({x: 8, y: 5, isOpen: false, blocksMovement: true});
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5}, [door]);

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toEqual({x: 6, y: 5});
  });

  it('возвращает null, если за целью свободная клетка (нет столкновения)', () => {
    // Открытая карта: ни одна точка приземления не даёт столкновения.
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5});

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toBeNull();
  });

  it('возвращает null, если цель не попадает в зону действия ни одной точки', () => {
    // Игрок слишком далеко: ни с одной точки приземления (jumpRadius 3)
    // зона aoeRadius 1 не достаёт до него.
    const {state, boss, player} = setup({x: 3, y: 5}, {x: 8, y: 5});

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toBeNull();
  });

  it('возвращает null для неизвестной способности', () => {
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5});

    const landing = findCollisionLanding(state, boss, 'unknown_ability', player);

    expect(landing).toBeNull();
  });

  it('детерминирована: из равнозначных точек выбирает по порядку (расстояние, x, y)', () => {
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5});
    // Сплошная стена-колонна x=8: столкновение дают точки (6,4), (6,5) и (6,6).
    for (let y = 1; y <= 8; y++) {
      state.map.tiles[y]![8] = 'wall';
    }

    const first = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);
    const second = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    // Все кандидаты на расстоянии 1, x одинаковый — побеждает минимальный y.
    expect(first).toEqual({x: 6, y: 4});
    expect(second).toEqual(first);
  });

  it('не считает текущую позицию кастера препятствием (к моменту толчка он прыгнул)', () => {
    // Кастер стоит на клетке за целью относительно точки приземления:
    // после прыжка эта клетка освобождается, столкновения не будет.
    const {state, boss, player} = setup({x: 8, y: 5}, {x: 7, y: 5});

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toBeNull();
  });

  it('не выбирает точку приземления, занятую актором (там подставка, а не столкновение)', () => {
    // Союзник босса занимает (6,5) — единственную точку, дающую столкновение
    // игрока со стеной (8,5). Приземление туда — подставка по союзнику.
    const occupant = makeEnemy({id: 'ally_6_5', x: 6, y: 5});
    const {state, boss, player} = setup({x: 4, y: 5}, {x: 7, y: 5}, [occupant]);
    state.map.tiles[5]![8] = 'wall';

    const landing = findCollisionLanding(state, boss, TEST_SWOOP_ID, player);

    expect(landing).toBeNull();
  });
});
