/**
 * API итоговых (effective) характеристик.
 *
 * Ответственность:
 * - Единая точка входа для получения финальных значений урона, брони и т.д.
 * - Для игрока: base resolver + modifier engine.
 * - Для врагов: плоские значения из state (без изменений).
 */

import type { Entity, StatActor } from '@simulation/types.ts';
import {
  getBaseMaxHp,
  getBaseDamage,
  getBaseArmor,
  getBaseDodgeChance,
  getBaseAccuracy,
  getBaseCritChance,
  getBaseCritMultiplier,
} from './base-resolver.ts';
import { applyModifiers } from './modifier-engine.ts';

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

export function getEffectiveWeaponDamage(entity: Entity): number {
  if (isStatActor(entity)) {
    const base = getBaseDamage(entity);
    return Math.round(applyModifiers(entity, 'damage', base).total);
  }
  return 0;
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

export function getEffectiveDodgeChance(actor: StatActor): number {
  const base = getBaseDodgeChance(actor);
  return applyModifiers(actor, 'dodgeChance', base).total;
}

export function getEffectiveAccuracy(actor: StatActor): number {
  const base = getBaseAccuracy(actor);
  return applyModifiers(actor, 'accuracy', base).total;
}

export function getEffectiveCritChance(actor: StatActor): number {
  const base = getBaseCritChance(actor);
  return applyModifiers(actor, 'critChance', base).total;
}

export function getEffectiveCritMultiplier(actor: StatActor): number {
  const base = getBaseCritMultiplier(actor);
  return applyModifiers(actor, 'critMultiplier', base).total;
}
