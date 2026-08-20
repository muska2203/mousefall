/**
 * Юнит-тесты механики сокрытия (concealsEntities у тайловых эффектов).
 *
 * Проверяет:
 * 1. tileConcealsEntities / isEntityConcealedFrom: concealing-клетка скрывает
 *    сущность от наблюдателя дальше 1 клетки (Чебышёв); blocksLOS без
 *    concealsEntities сущностей не скрывает.
 * 2. AI: canSeePlayer не видит игрока на concealing-клетке с дистанции 2+,
 *    видит вплотную и без облака.
 * 3. Атака: attackEntity.validate отклоняет позиционную атаку по скрытой цели
 *    с reasonCode no_line_of_sight; вплотную цель доступна.
 * 4. getDamageablePositionsWithinRange исключает скрытую цель.
 * 5. GameSimulation.getBasicAttackValidTargets не содержит скрытого врага.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {isEntityConcealedFrom, tileConcealsEntities} from '../../../src/simulation/state';
import {canSeePlayer} from '../../../src/simulation/ai/ai-helpers';
import {attackEntity} from '../../../src/simulation/systems/actions/attack-action';
import {getDamageablePositionsWithinRange} from '../../../src/simulation/skills/targeting';
import {resetRegistry} from '../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
} from '../../fixtures/gameState';
import {createTestSimulation} from '../../helpers/simulation';
import type {ItemTemplate, TileEffectTemplate} from '../../../src/content/schemas';
import type {AttackAction} from '../../../src/simulation/systems/actions/types';
import type {EntityId, GameplayTag} from '../../../src/simulation/core-types';
import type {Entity, GameState} from '../../../src/simulation/types';
import type {TileEffectLayer} from '../../../src/simulation/core-types';
import {PLAYER_ID} from '../../../src/utils/constants';

// ─────────────────────────────────────────────
// Мок-шаблоны
// ─────────────────────────────────────────────

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & {id: string}): TileEffectTemplate {
  return {
    layer: 'aboveGround',
    duration: 4,
    renderOrder: 1,
    blocksLOS: false,
    concealsEntities: false,
    ruleIds: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function mockWeapon(
  id: string,
  overrides: { range?: number; minRange?: number } = {},
): ItemTemplate {
  return {
    id,
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
      damageDistribution: [{ damageTag: 'damage.physical.slashing' as GameplayTag, weight: 1.0 }],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    },
  } as ItemTemplate;
}

// Меч: ближний бой, range 1 / minRange 1.
const SWORD_TEMPLATE = mockWeapon('sword');
// Праща: дальний бой, range 5 / minRange 2 — бьёт скрытую цель с дистанции 2.
const SLING_TEMPLATE = mockWeapon('sling', { range: 5, minRange: 2 });

function initConcealmentRegistry(): void {
  initObjectContentRegistry({
    tileEffects: new Map([
      // Concealing-эффект (аналог flour_cloud): блокирует обзор и скрывает сущностей.
      ['flour_cloud', mockTileEffectTemplate({ id: 'flour_cloud', blocksLOS: true, concealsEntities: true })],
      // Контроль: blocksLOS без concealsEntities сущностей не скрывает.
      ['smoke', mockTileEffectTemplate({ id: 'smoke', blocksLOS: true })],
    ]),
    items: new Map([
      [SWORD_TEMPLATE.id, SWORD_TEMPLATE],
      [SLING_TEMPLATE.id, SLING_TEMPLATE],
    ]),
  });
}

function putEffect(state: GameState, x: number, y: number, type: string, layer: TileEffectLayer = 'aboveGround'): void {
  state.tileEffects[y]![x]![layer] = { type, duration: 3, layer, statusEffects: [], renderOrder: 1 };
}

function makeStateWith(weaponId: string | null, enemies: ReturnType<typeof makeEnemy>[]): GameState {
  const player = makePlayer({ x: 5, y: 5, equippedWeaponId: weaponId });
  const entities = new Map<EntityId, Entity>([[player.id, player]]);
  for (const enemy of enemies) {
    entities.set(enemy.id, enemy);
  }
  return makeGameState({ player, entities });
}

function positionalAttack(targetPosition: { x: number; y: number }): AttackAction {
  return { type: 'ATTACK', entityId: PLAYER_ID, dx: 0, dy: 0, targetPosition };
}

beforeEach(() => {
  initConcealmentRegistry();
});

afterEach(() => {
  resetRegistry();
});

describe('tileConcealsEntities', () => {
  it('клетка без эффектов не скрывает сущностей', () => {
    const state = makeGameState();
    expect(tileConcealsEntities(state, 4, 4)).toBe(false);
  });

  it('клетка с concealing-эффектом скрывает сущностей', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'flour_cloud');
    expect(tileConcealsEntities(state, 4, 4)).toBe(true);
  });

  it('эффект с blocksLOS, но без concealsEntities, не скрывает сущностей', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'smoke');
    expect(tileConcealsEntities(state, 4, 4)).toBe(false);
  });

  it('клетка вне карты не скрывает сущностей', () => {
    const state = makeGameState();
    expect(tileConcealsEntities(state, -1, 0)).toBe(false);
    expect(tileConcealsEntities(state, 0, 100)).toBe(false);
  });
});

describe('isEntityConcealedFrom', () => {
  it('наблюдатель на той же клетке (дистанция 0) — сущность не скрыта', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'flour_cloud');
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 4, y: 4 })).toBe(false);
  });

  it('наблюдатель на соседней клетке (дистанция 1) — сущность не скрыта', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'flour_cloud');
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 5, y: 5 })).toBe(false);
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 4, y: 5 })).toBe(false);
  });

  it('наблюдатель на дистанции 2 — сущность скрыта', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'flour_cloud');
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 6, y: 4 })).toBe(true);
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 6, y: 6 })).toBe(true);
  });

  it('неконсеaling-эффект (smoke) не скрывает даже на дистанции 2', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'smoke');
    expect(isEntityConcealedFrom(state, { x: 4, y: 4 }, { x: 6, y: 4 })).toBe(false);
  });
});

describe('AI: canSeePlayer с сокрытием', () => {
  it('игрок на concealing-клетке не виден врагу с дистанции 2', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_far', x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    putEffect(state, 5, 5, 'flour_cloud');

    expect(canSeePlayer(enemy, state)).toBe(false);
  });

  it('контроль: без облака враг видит игрока с дистанции 2', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_far', x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    expect(canSeePlayer(enemy, state)).toBe(true);
  });

  it('игрок на concealing-клетке виден врагу вплотную (дистанция 1)', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_near', x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    putEffect(state, 5, 5, 'flour_cloud');

    expect(canSeePlayer(enemy, state)).toBe(true);
  });
});

describe('attackEntity.validate с сокрытием', () => {
  it('отклоняет позиционную атаку по скрытой цели с reasonCode no_line_of_sight', () => {
    // Праща (range 5): цель на дистанции 2 в LOS, но на concealing-клетке.
    const enemy = makeEnemy({ id: 'enemy_concealed', x: 5, y: 7 });
    const state = makeStateWith('sling', [enemy]);
    putEffect(state, 5, 7, 'flour_cloud');

    const result = attackEntity.validate(state, positionalAttack({ x: 5, y: 7 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('no_line_of_sight');
    }
  });

  it('контроль: та же цель без облака — валидна', () => {
    const enemy = makeEnemy({ id: 'enemy_visible', x: 5, y: 7 });
    const state = makeStateWith('sling', [enemy]);

    expect(attackEntity.validate(state, positionalAttack({ x: 5, y: 7 })).ok).toBe(true);
  });

  it('цель на concealing-клетке вплотную (дистанция 1) — валидна', () => {
    const enemy = makeEnemy({ id: 'enemy_adjacent', x: 6, y: 5 });
    const state = makeStateWith('sword', [enemy]);
    putEffect(state, 6, 5, 'flour_cloud');

    expect(attackEntity.validate(state, positionalAttack({ x: 6, y: 5 })).ok).toBe(true);
  });
});

describe('getDamageablePositionsWithinRange с сокрытием', () => {
  it('исключает цель на concealing-клетке с дистанции 2', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_concealed', x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    putEffect(state, 5, 7, 'flour_cloud');

    const positions = getDamageablePositionsWithinRange(state, player, 3);
    expect(positions).not.toContainEqual({ x: 5, y: 7 });
  });

  it('включает цель на concealing-клетке с дистанции 1', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_adjacent', x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    putEffect(state, 5, 6, 'flour_cloud');

    const positions = getDamageablePositionsWithinRange(state, player, 3);
    expect(positions).toContainEqual({ x: 5, y: 6 });
  });

  it('контроль: без облака цель на дистанции 2 включена', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_visible', x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const positions = getDamageablePositionsWithinRange(state, player, 3);
    expect(positions).toContainEqual({ x: 5, y: 7 });
  });
});

describe('GameSimulation.getBasicAttackValidTargets с сокрытием', () => {
  it('не содержит врага на concealing-клетке с дистанции 2', () => {
    const enemy = makeEnemy({ id: 'enemy_concealed', x: 5, y: 7 });
    const state = makeStateWith('sling', [enemy]);
    putEffect(state, 5, 7, 'flour_cloud');
    const sim = createTestSimulation(state);

    expect(sim.getBasicAttackValidTargets()).not.toContainEqual({ x: 5, y: 7 });
  });

  it('контроль: тот же враг без облака — в списке целей', () => {
    const enemy = makeEnemy({ id: 'enemy_visible', x: 5, y: 7 });
    const state = makeStateWith('sling', [enemy]);
    const sim = createTestSimulation(state);

    expect(sim.getBasicAttackValidTargets()).toContainEqual({ x: 5, y: 7 });
  });

  it('содержит врага на concealing-клетке вплотную (дистанция 1)', () => {
    const enemy = makeEnemy({ id: 'enemy_adjacent', x: 6, y: 5 });
    const state = makeStateWith('sword', [enemy]);
    putEffect(state, 6, 5, 'flour_cloud');
    const sim = createTestSimulation(state);

    expect(sim.getBasicAttackValidTargets()).toContainEqual({ x: 6, y: 5 });
  });
});
