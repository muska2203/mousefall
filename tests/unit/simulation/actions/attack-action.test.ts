/**
 * Тесты обработчика базовой атаки (attackEntity):
 * - позиционная форма (targetPosition): дальность по предикату isInWeaponRange
 *   (дистанция Чебышёва ∈ [minRange, range]), LOS;
 * - направленная форма (legacy bump): дальнобойное оружие (minRange > 1) в упор
 *   отклоняется с reason-кодом too_close_for_ranged_weapon;
 * - API симуляции для UI: getBasicAttackTargetMode / getBasicAttackValidTargets /
 *   getBasicAttackRangeCells.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
} from '../../../fixtures/gameState';
import {createTestSimulation} from '../../../helpers/simulation';
import {attackEntity} from '../../../../src/simulation/systems/actions/attack-action';
import {resetRegistry} from '../../../../src/content/registry';
import type {ItemTemplate} from '../../../../src/content/schemas';
import type {AttackAction} from '../../../../src/simulation/systems/actions/types';
import type {EntityId, GameplayTag} from '../../../../src/simulation/core-types';
import type {Entity} from '../../../../src/simulation/types';
import {PLAYER_ID} from '../../../../src/utils/constants';

// ─────────────────────────────────────────────
// Мок-шаблоны оружия
// ─────────────────────────────────────────────

function mockWeapon(
  id: string,
  overrides: {
    damage?: { min: number; max: number };
    range?: number;
    minRange?: number;
    damageDistribution?: Array<{ damageTag: GameplayTag; weight: number }>;
    tags?: GameplayTag[];
  } = {},
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
      damage: overrides.damage ?? { min: 4, max: 6 },
      range: overrides.range ?? 1,
      minRange: overrides.minRange ?? 1,
      damageDistribution: overrides.damageDistribution
        ?? [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
      tags: overrides.tags ?? ['attack.melee', 'target.single', 'delivery.weapon'],
    },
  } as ItemTemplate;
}

/** Безоружный шаблон: урон {1,1}, тупой физический урон, unarmed-теги. */
const UNARMED_TEMPLATE = mockWeapon('unarmed', {
  damage: { min: 1, max: 1 },
  damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
  tags: ['attack.melee', 'target.single', 'delivery.weapon', 'delivery.unarmed'],
});

/** Ближний бой: меч {4..6}, режущий, range 1 / minRange 1. */
const SWORD_TEMPLATE = mockWeapon('sword');

/** Дальний бой: праща {2..4}, дробящий, range 5 / minRange 2. */
const SLING_TEMPLATE = mockWeapon('sling', {
  damage: { min: 2, max: 4 },
  range: 5,
  minRange: 2,
  damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
  tags: ['attack.ranged', 'target.single', 'delivery.weapon'],
});

// ─────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────

function makeStateWith(attackerWeaponId: string | null, enemies: ReturnType<typeof makeEnemy>[]) {
  const player = makePlayer({ x: 5, y: 5, equippedWeaponId: attackerWeaponId });
  const entities = new Map<EntityId, Entity>([[player.id, player]]);
  for (const enemy of enemies) {
    entities.set(enemy.id, enemy);
  }
  return makeGameState({ player, entities });
}

function positionalAttack(targetPosition: { x: number; y: number }): AttackAction {
  return { type: 'ATTACK', entityId: PLAYER_ID, dx: 0, dy: 0, targetPosition };
}

function directionalAttack(dx: number, dy: number): AttackAction {
  return { type: 'ATTACK', entityId: PLAYER_ID, dx, dy };
}

describe('attackEntity — позиционная форма (targetPosition)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      items: new Map([
        [UNARMED_TEMPLATE.id, UNARMED_TEMPLATE],
        [SWORD_TEMPLATE.id, SWORD_TEMPLATE],
        [SLING_TEMPLATE.id, SLING_TEMPLATE],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('наносит урон валидной цели в дальности с LOS, с тегами оружия', () => {
    // Праща range 5 / minRange 2: враг на дистанции 3, прямая видимость.
    const enemy = makeEnemy({ id: 'enemy_far', x: 5, y: 8 });
    const state = makeStateWith('sling', [enemy]);

    const action = positionalAttack({ x: 5, y: 8 });
    const validation = attackEntity.validate(state, action);
    expect(validation.ok).toBe(true);

    const intents = attackEntity.resolve(state, action);
    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    expect(intent.type).toBe('DAMAGE');
    if (intent.type !== 'DAMAGE') return;
    expect(intent.entityId).toBe(enemy.id);
    expect(intent.sourceEntityId).toBe(PLAYER_ID);
    expect(intent.damage).toBeGreaterThanOrEqual(2);
    expect(intent.damage).toBeLessThanOrEqual(4);
    expect(intent.tags).toContain('attack.ranged');
    expect(intent.tags).toContain('delivery.weapon');
    expect(intent.tags).toContain('damage.physical.blunt');
  });

  it('отклоняет цель вне дальности оружия', () => {
    // Меч range 1: цель на чебышёвской дистанции 3 — вне досягаемости.
    const enemy = makeEnemy({ id: 'enemy_too_far', x: 5, y: 8 });
    const state = makeStateWith('sword', [enemy]);

    const result = attackEntity.validate(state, positionalAttack({ x: 5, y: 8 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('target_out_of_range');
    }
  });

  it('отклоняет позиционную цель ближе minRange', () => {
    // Праща minRange 2: соседняя клетка (дистанция 1) недоступна позиционной форме.
    const enemy = makeEnemy({ id: 'enemy_close', x: 6, y: 5 });
    const state = makeStateWith('sling', [enemy]);

    const result = attackEntity.validate(state, positionalAttack({ x: 6, y: 5 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('target_too_close');
    }
  });

  it('отклоняет цель без прямой видимости (стена между)', () => {
    const enemy = makeEnemy({ id: 'enemy_behind_wall', x: 7, y: 5 });
    const state = makeStateWith('sling', [enemy]);
    state.map.tiles[5]![6] = 'wall';

    const result = attackEntity.validate(state, positionalAttack({ x: 7, y: 5 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('no_line_of_sight');
    }
  });

  it('отклоняет пустую клетку', () => {
    const state = makeStateWith('sling', []);

    const result = attackEntity.validate(state, positionalAttack({ x: 5, y: 7 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('no_target_at_tile');
    }
  });

  it('melee-оружие (minRange 1) бьёт диагонального соседа позиционной формой', () => {
    // Меч range 1 / minRange 1: диагональный сосед (Чебышёв 1) — валидная цель.
    const enemy = makeEnemy({ id: 'enemy_diag', x: 6, y: 6 });
    const state = makeStateWith('sword', [enemy]);

    const action = positionalAttack({ x: 6, y: 6 });
    const validation = attackEntity.validate(state, action);
    expect(validation.ok).toBe(true);

    const intents = attackEntity.resolve(state, action);
    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    if (intent.type !== 'DAMAGE') throw new Error('ожидался DAMAGE-интент');
    expect(intent.entityId).toBe(enemy.id);
    expect(intent.damage).toBeGreaterThanOrEqual(4);
    expect(intent.damage).toBeLessThanOrEqual(6);
    expect(intent.tags).toContain('attack.melee');
    expect(intent.tags).toContain('damage.physical.slashing');
  });

  it('дальнобойное оружие (minRange 2) не бьёт ни по одной из 8 соседних клеток', () => {
    // Праща minRange 2 по Чебышёву: ортогональный и диагональный соседи (дистанция 1)
    // отклоняются, а клетка на дистанции 2 — валидна.
    const adjacent = makeEnemy({ id: 'enemy_adj', x: 6, y: 5 });
    const diagonal = makeEnemy({ id: 'enemy_diag', x: 6, y: 6 });
    const inRing = makeEnemy({ id: 'enemy_ring', x: 7, y: 7 });
    const state = makeStateWith('sling', [adjacent, diagonal, inRing]);

    for (const pos of [{ x: 6, y: 5 }, { x: 6, y: 6 }]) {
      const result = attackEntity.validate(state, positionalAttack(pos));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reasonCode).toBe('target_too_close');
      }
    }
    expect(attackEntity.validate(state, positionalAttack({ x: 7, y: 7 })).ok).toBe(true);
  });
});

describe('attackEntity — направленная форма (legacy bump)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      items: new Map([
        [UNARMED_TEMPLATE.id, UNARMED_TEMPLATE],
        [SWORD_TEMPLATE.id, SWORD_TEMPLATE],
        [SLING_TEMPLATE.id, SLING_TEMPLATE],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('bump с обычным оружием (minRange 1) бьёт оружием — регрессия не сломана', () => {
    const enemy = makeEnemy({ id: 'enemy_melee', x: 6, y: 5 });
    const state = makeStateWith('sword', [enemy]);

    const action = directionalAttack(1, 0);
    expect(attackEntity.validate(state, action).ok).toBe(true);

    const intents = attackEntity.resolve(state, action);
    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    if (intent.type !== 'DAMAGE') throw new Error('ожидался DAMAGE-интент');
    expect(intent.damage).toBeGreaterThanOrEqual(4);
    expect(intent.damage).toBeLessThanOrEqual(6);
    expect(intent.tags).toContain('attack.melee');
    expect(intent.tags).toContain('damage.physical.slashing');
    expect(intent.tags).not.toContain('delivery.unarmed');
  });

  it('bump дальнобойным оружием (minRange 2) в упор отклоняется: too_close_for_ranged_weapon', () => {
    const enemy = makeEnemy({ id: 'enemy_bump', x: 6, y: 5 });
    const state = makeStateWith('sling', [enemy]);

    const action = directionalAttack(1, 0);
    const result = attackEntity.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('too_close_for_ranged_weapon');
    }
    // Отклонённое действие не порождает интентов.
    expect(attackEntity.resolve(state, action)).toHaveLength(0);
  });

  it('bump без оружия — безоружные урон и теги (регрессия не сломана)', () => {
    const enemy = makeEnemy({ id: 'enemy_unarmed', x: 6, y: 5 });
    const state = makeStateWith(null, [enemy]);

    const intents = attackEntity.resolve(state, directionalAttack(1, 0));
    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    if (intent.type !== 'DAMAGE') throw new Error('ожидался DAMAGE-интент');
    expect(intent.damage).toBe(1);
    expect(intent.tags).toContain('delivery.unarmed');
  });

  it('bump по диагональной соседней клетке по-прежнему работает', () => {
    const enemy = makeEnemy({ id: 'enemy_diag', x: 6, y: 6 });
    const state = makeStateWith('sword', [enemy]);

    expect(attackEntity.validate(state, directionalAttack(1, 1)).ok).toBe(true);
  });

  it('отклоняет bump в пустую клетку', () => {
    const state = makeStateWith('sword', []);

    const result = attackEntity.validate(state, directionalAttack(1, 0));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('no_target_at_tile');
    }
  });
});

describe('GameSimulation — API таргетинга базовой атаки', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      items: new Map([
        [UNARMED_TEMPLATE.id, UNARMED_TEMPLATE],
        [SWORD_TEMPLATE.id, SWORD_TEMPLATE],
        [SLING_TEMPLATE.id, SLING_TEMPLATE],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('melee (range 1, minRange 1): mode {single, 1}, валидные цели — все 8 соседей', () => {
    const near = makeEnemy({ id: 'enemy_n', x: 6, y: 5 });
    const nearVertical = makeEnemy({ id: 'enemy_v', x: 5, y: 4 });
    // Диагональный сосед тоже валиден: range 1 по Чебышёву — все 8 соседних клеток.
    const diagonal = makeEnemy({ id: 'enemy_d', x: 6, y: 6 });
    const state = makeStateWith('sword', [near, nearVertical, diagonal]);
    const sim = createTestSimulation(state);

    expect(sim.getBasicAttackTargetMode()).toEqual({ type: 'single', range: 1 });

    const targets = sim.getBasicAttackValidTargets();
    expect(targets).toContainEqual({ x: 6, y: 5 });
    expect(targets).toContainEqual({ x: 5, y: 4 });
    expect(targets).toContainEqual({ x: 6, y: 6 });
  });

  it('дальнее (range 5, minRange 2): mode {single, 5}, кольцо без соседних клеток, LOS учитывается', () => {
    const inRing = makeEnemy({ id: 'enemy_ring', x: 5, y: 8 });
    const tooClose = makeEnemy({ id: 'enemy_close', x: 6, y: 5 });
    const behindWall = makeEnemy({ id: 'enemy_wall', x: 8, y: 5 });
    const state = makeStateWith('sling', [inRing, tooClose, behindWall]);
    state.map.tiles[5]![7] = 'wall';
    const sim = createTestSimulation(state);

    expect(sim.getBasicAttackTargetMode()).toEqual({ type: 'single', range: 5 });

    const targets = sim.getBasicAttackValidTargets();
    // Цель на дистанции 3 в кольце [2, 5] и в LOS.
    expect(targets).toContainEqual({ x: 5, y: 8 });
    // Соседняя клетка (дистанция 1 < minRange 2) не входит.
    expect(targets).not.toContainEqual({ x: 6, y: 5 });
    // Цель за стеной (7,5) не видна из (5,5).
    expect(targets).not.toContainEqual({ x: 8, y: 5 });
  });

  it('getBasicAttackRangeCells: melee (range 1) — все 8 соседних клеток', () => {
    const state = makeStateWith('sword', []);
    const sim = createTestSimulation(state);

    const cells = sim.getBasicAttackRangeCells();
    expect(cells).toHaveLength(8);
    expect(cells).toContainEqual({ x: 6, y: 6 });
    expect(cells).toContainEqual({ x: 4, y: 4 });
    expect(cells).not.toContainEqual({ x: 5, y: 5 });
  });

  it('getBasicAttackRangeCells: праща (range 5, minRange 2) — чебышёвское кольцо [2, 5] без клеток дистанции 1', () => {
    const state = makeStateWith('sling', []);
    const sim = createTestSimulation(state);

    const cells = sim.getBasicAttackRangeCells();
    // Кольцо чебышёвских дистанций 2..5: вся карта 10×10 в пределах дистанции 5
    // от центра (5,5), минус 9 клеток дистанции < 2 (клетка игрока + 8 соседей) → 91.
    expect(cells).toHaveLength(91);
    // (5,8) — дистанция 3 в кольце; (7,7) — диагональная клетка дистанции 2 ∈ [2, 5].
    expect(cells).toContainEqual({ x: 5, y: 8 });
    expect(cells).toContainEqual({ x: 7, y: 7 });
    // Все 8 соседних клеток (дистанция 1 < minRange) не включаются.
    expect(cells).not.toContainEqual({ x: 6, y: 5 });
    expect(cells).not.toContainEqual({ x: 5, y: 6 });
    expect(cells).not.toContainEqual({ x: 6, y: 6 });
    // Клетка игрока не включается.
    expect(cells).not.toContainEqual({ x: 5, y: 5 });
  });
});
