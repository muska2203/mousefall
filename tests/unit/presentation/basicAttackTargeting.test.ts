/**
 * Тесты режима таргетинга базовой атаки и слота оружия в хотбаре (GameSession).
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import '@i18n/config';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy, createTestTerrains } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate, ItemTemplate } from '../../../src/content/schemas';
import type { EnemyEntity, Entity, EntityId, GameState } from '../../../src/simulation/types';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'fireball',
    range: 5,
    aoeRadius: 1,
    centerDamage: 20,
    aoeDamage: 10,
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

function mockWeapon(
  id: string,
  overrides: { name?: string; range?: number; minRange?: number } = {},
): ItemTemplate {
  return {
    id,
    name: overrides.name ?? id,
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

/** Ближний бой: меч, range 1 / minRange 1. */
const SWORD_TEMPLATE = mockWeapon('sword', { name: 'Тестовый меч' });

/** Дальний бой: праща, range 5 / minRange 2. */
const SLING_TEMPLATE = mockWeapon('sling', {
  name: 'Тестовая праща',
  range: 5,
  minRange: 2,
});

/** Игрок с экипированным оружием в инвентаре. */
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

/** Собрать состояние с игроком и произвольным набором сущностей. */
function makeStateWith(player: ReturnType<typeof makePlayer>, entities: Entity[] = []) {
  const map = new Map<EntityId, Entity>([[player.id, player]]);
  for (const entity of entities) {
    map.set(entity.id, entity);
  }
  return makeGameState({ player, entities: map });
}

/** HP врага по id (undefined, если сущности нет). */
function getEnemyHp(state: GameState, id: string): number | undefined {
  const entity = state.entities.get(id);
  return entity && 'hp' in entity ? (entity as EnemyEntity).hp : undefined;
}

describe('GameSession basic attack targeting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map([
        [SWORD_TEMPLATE.id, SWORD_TEMPLATE],
        [SLING_TEMPLATE.id, SLING_TEMPLATE],
      ]),
      abilities: new Map([
        ['fireball', mockAbility('fireball')],
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

  it('weapon slot is always the first hotbar slot', () => {
    const player = makePlayerWithWeapon('sword');
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);

    const slot = session.getViewModel().renderInput!.hotbar[0]!;
    expect(slot.kind).toBe('weapon');
    expect(slot.icon).toBe('/assets/items/sword.png');
    expect(slot.isAvailable).toBe(true);
    expect(slot.isActive).toBe(false);
    expect(slot.apCost).toBe(1);
  });

  it('weapon slot tooltip contains action name and weapon name', () => {
    const player = makePlayerWithWeapon('sword');
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);

    const tooltip = session.getViewModel().renderInput!.hotbar[0]!.tooltip;
    expect(tooltip?.kind).toBe('weapon');
    if (tooltip?.kind !== 'weapon') return;
    expect(tooltip.name).toBe('Базовая атака');
    // Имя оружия проходит через контентные тексты; для тестового id без текстов — маркер [id].
    expect(tooltip.weaponName).toBe('[sword]');
    expect(tooltip.hint.length).toBeGreaterThan(0);
  });

  it('weapon slot without weapon shows fallback and unarmed label', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);

    const slot = session.getViewModel().renderInput!.hotbar[0]!;
    expect(slot.kind).toBe('weapon');
    expect(slot.icon).toBeNull();
    expect(slot.fallback).toBe('⚔');
    const tooltip = slot.tooltip;
    if (tooltip?.kind !== 'weapon') throw new Error('expected weapon tooltip');
    expect(tooltip.weaponName).toBe('Без оружия');
  });

  it('activateHotbarSlot(0) begins basic attack targeting with valid targets from simulation', () => {
    const player = makePlayerWithWeapon('sword');
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    expect(session.isTargeting()).toBe(true);

    const renderInput = session.getViewModel().renderInput!;
    expect(renderInput.hotbar[0]!.isActive).toBe(true);
    const overlay = renderInput.targetingOverlay;
    expect(overlay).not.toBeNull();
    expect(overlay!.valid).toContainEqual({ x: 6, y: 5 });
  });

  it('activating weapon slot again cancels targeting', () => {
    const player = makePlayerWithWeapon('sword');
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);
    session.activateHotbarSlot(0);

    expect(session.isTargeting()).toBe(false);
    expect(session.getViewModel().renderInput!.targetingOverlay).toBeNull();
    expect(session.getViewModel().renderInput!.hotbar[0]!.isActive).toBe(false);
  });

  it('cancelTargeting resets basic attack targeting', () => {
    const player = makePlayerWithWeapon('sword');
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);
    session.cancelTargeting();

    expect(session.isTargeting()).toBe(false);
    expect(session.getViewModel().renderInput!.targetingOverlay).toBeNull();
  });

  it('submitTarget on a valid cell dispatches ATTACK with targetPosition (melee)', () => {
    const player = makePlayerWithWeapon('sword', { ap: 3, maxAp: 3 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);
    session.submitTarget({ x: 6, y: 5 });

    const nextState = session.getViewModel().renderInput!.state;
    expect(getEnemyHp(nextState, 'enemy_1')).toBeLessThan(20);
    expect(session.isTargeting()).toBe(false);
  });

  it('submitTarget reaches a distant enemy with a ranged weapon (positional attack)', () => {
    const player = makePlayerWithWeapon('sling', { ap: 3, maxAp: 3 });
    // Дистанция 3 — недостижима для bump-атаки, попадание доказывает позиционную форму.
    const enemy = makeEnemy({ id: 'enemy_1', x: 8, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    const overlay = session.getViewModel().renderInput!.targetingOverlay;
    expect(overlay!.valid).toContainEqual({ x: 8, y: 5 });

    session.submitTarget({ x: 8, y: 5 });

    const nextState = session.getViewModel().renderInput!.state;
    expect(getEnemyHp(nextState, 'enemy_1')).toBeLessThan(20);
  });

  it('submitTarget dispatches ATTACK with direction toward the target (for attack animation)', () => {
    const player = makePlayerWithWeapon('sling', { ap: 3, maxAp: 3 });
    // Игрок (5,5), враг (8,5) — направление на цель (1, 0).
    const enemy = makeEnemy({ id: 'enemy_1', x: 8, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    // Планировщик анимаций строит выпад по dx/dy действия — фиксируем контракт.
    const dispatchSpy = vi.spyOn(session, 'dispatch');
    session.activateHotbarSlot(0);
    session.submitTarget({ x: 8, y: 5 });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ATTACK', dx: 1, dy: 0, targetPosition: { x: 8, y: 5 } }),
    );
  });

  it('ranged weapon respects minRange: adjacent enemy is not a valid target', () => {
    const player = makePlayerWithWeapon('sling');
    const closeEnemy = makeEnemy({ id: 'enemy_close', x: 6, y: 5 });
    const farEnemy = makeEnemy({ id: 'enemy_far', x: 7, y: 5 });
    const state = makeStateWith(player, [closeEnemy, farEnemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    const overlay = session.getViewModel().renderInput!.targetingOverlay;
    expect(overlay!.valid).not.toContainEqual({ x: 6, y: 5 });
    expect(overlay!.valid).toContainEqual({ x: 7, y: 5 });
  });

  it('submitTarget on a cell outside the radius does not dispatch and cancels targeting', () => {
    const player = makePlayerWithWeapon('sword', { ap: 3, maxAp: 3 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    const dispatchSpy = vi.spyOn(session, 'dispatch');
    session.activateHotbarSlot(0);

    // Пустая клетка вне досягаемости — клик мимо цели отменяет режим без атаки.
    session.submitTarget({ x: 2, y: 2 });

    const renderInput = session.getViewModel().renderInput!;
    expect(getEnemyHp(renderInput.state, 'enemy_1')).toBe(20);
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ATTACK' }));
    expect(session.isTargeting()).toBe(false);
    expect(renderInput.targetingOverlay).toBeNull();
  });

  it('submitTarget on an empty cell inside the radius does not dispatch and cancels targeting', () => {
    const player = makePlayerWithWeapon('sword', { ap: 3, maxAp: 3 });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 20, maxHp: 20 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    const dispatchSpy = vi.spyOn(session, 'dispatch');
    session.activateHotbarSlot(0);

    // Пустая клетка в радиусе досягаемости (5,6) — атаки нет, но режим снимается.
    const overlay = session.getViewModel().renderInput!.targetingOverlay;
    expect(overlay!.radiusCells).toContainEqual({ x: 5, y: 6 });

    session.submitTarget({ x: 5, y: 6 });

    const renderInput = session.getViewModel().renderInput!;
    expect(getEnemyHp(renderInput.state, 'enemy_1')).toBe(20);
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ATTACK' }));
    expect(session.isTargeting()).toBe(false);
  });

  it('targeting overlay highlights the whole reach radius (radiusCells) for melee', () => {
    const player = makePlayerWithWeapon('sword');
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    const overlay = session.getViewModel().renderInput!.targetingOverlay;
    expect(overlay).not.toBeNull();
    // Melee (minRange 1): вся зона — 8 соседних клеток, включая диагонали.
    expect(overlay!.radiusCells).toHaveLength(8);
    expect(overlay!.radiusCells).toContainEqual({ x: 6, y: 6 });
    // Валидные цели — только клетки с врагами.
    expect(overlay!.valid).toEqual([{ x: 6, y: 5 }]);
  });

  it('previewTarget marks hovered valid cell as affected', () => {
    const player = makePlayerWithWeapon('sword');
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    const state = makeStateWith(player, [enemy]);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    const preview = session.previewTarget({ x: 6, y: 5 });
    expect(preview.valid).toBe(true);
    expect(preview.affectedPositions).toEqual([{ x: 6, y: 5 }]);

    const overlay = session.getViewModel().renderInput!.targetingOverlay;
    expect(overlay!.hover).toEqual({ x: 6, y: 5 });
    expect(overlay!.affected).toEqual([{ x: 6, y: 5 }]);
  });

  it('beginBasicAttackTargeting shows toast and does not start when not enough AP', () => {
    const player = makePlayerWithWeapon('sword', { ap: 0, maxAp: 3 });
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);
    session.activateHotbarSlot(0);

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
    expect(session.isTargeting()).toBe(false);
    expect(vm.toasts).toHaveLength(1);
    expect(vm.toasts[0]!.kind).toBe('warning');
  });

  it('beginBasicAttackTargeting cancels active ability targeting', () => {
    const player = makePlayerWithWeapon('sword', {
      ap: 3,
      maxAp: 3,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeStateWith(player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    expect(session.isTargeting()).toBe(true);

    session.activateHotbarSlot(0);

    // Режим переключился на базовую атаку, ability-таргетинг сброшен.
    expect(session.isTargeting()).toBe(true);
    expect(session.getViewModel().renderInput!.hotbar[0]!.isActive).toBe(true);
    expect(session.getViewModel().renderInput!.hotbar[1]!.isActive).toBe(false);
  });
});
