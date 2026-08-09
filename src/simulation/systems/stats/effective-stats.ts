/**
 * API итоговых (effective) характеристик.
 *
 * Ответственность:
 * - Единая точка входа для получения финальных значений урона, брони и т.д.
 * - Для игрока: base resolver + modifier engine.
 * - Для врагов: плоские значения из state (без изменений).
 */

import type {Entity, StatActor} from '@simulation/types.ts';
import type {DamageRange} from '@simulation/core-types.ts';
import {
    getBaseArmor,
    getBaseCritMultiplier,
    getBaseDamageRange,
    getBaseMaxHp,
} from './base-resolver.ts';
import {applyModifiers} from './modifier-engine.ts';

// ─────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────

/** Type guard: сущность имеет базовые характеристики (StatActor). */
export function isStatActor(entity: Entity): entity is Entity & StatActor {
  return 'baseStats' in entity;
}

// ─────────────────────────────────────────────
// Урон и броня (полиморфные)
// ─────────────────────────────────────────────

/**
 * Применяет модификаторы 'damage' к рейнжу урона: add и multiply
 * применяются к обоим концам, каждый конец итога ≥ 0.
 */
export function applyDamageModifiers(actor: StatActor, base: DamageRange): DamageRange {
  return {
    min: Math.round(applyModifiers(actor, 'damage', base.min).total),
    max: Math.round(applyModifiers(actor, 'damage', base.max).total),
  };
}

/**
 * Итоговый рейнж урона оружия с учётом модификаторов.
 * Конкретное значение роллится в момент удара (rollWeaponDamage).
 */
export function getEffectiveWeaponDamageRange(entity: Entity): DamageRange {
  if (isStatActor(entity)) {
    return applyDamageModifiers(entity, getBaseDamageRange(entity));
  }
  return { min: 0, max: 0 };
}

export function getEffectiveArmor(entity: Entity): number {
  if (isStatActor(entity)) {
    const base = getBaseArmor(entity);
    return Math.round(applyModifiers(entity, 'armor', base).total);
  }
  // Для не-StatActor, но имеющих броню (например, дверей), используем плоское значение.
  if ('armor' in entity) {
    return (entity as { armor: number }).armor;
  }
  return 0;
}

// ─────────────────────────────────────────────
// Жизнь (только игрок)
// ─────────────────────────────────────────────

export function getEffectiveMaxHp(actor: StatActor): number {
  const base = getBaseMaxHp(actor);
  return applyModifiers(actor, 'maxHp', base).total;
}

// ─────────────────────────────────────────────
// Вторичные характеристики (рассчитываются для StatActor)
// ─────────────────────────────────────────────

export function getEffectiveCritMultiplier(actor: StatActor): number {
  const base = getBaseCritMultiplier(actor);
  return applyModifiers(actor, 'critMultiplier', base).total;
}
