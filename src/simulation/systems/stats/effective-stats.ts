/**
 * API итоговых (effective) характеристик.
 *
 * Ответственность:
 * - Единая точка входа для получения финальных значений урона, брони и т.д.
 * - Для игрока: base resolver + modifier engine.
 * - Для врагов: плоские значения из state (без изменений).
 */

import type { Actor, Entity, PlayerEntity } from '@simulation/types.ts';
import {
  getBaseMaxHp,
  getBaseMaxMp,
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

function isPlayer(entity: Entity): entity is PlayerEntity {
  return entity.type === 'player';
}

// ─────────────────────────────────────────────
// Урон и броня (полиморфные)
// ─────────────────────────────────────────────

export function getEffectiveDamage(entity: Entity): number {
  if (isPlayer(entity)) {
    const base = getBaseDamage(entity);
    return applyModifiers(entity, 'damage', base).total;
  }
  // Враги и прочие — плоское значение
  return (entity as Actor).damage;
}

export function getEffectiveArmor(entity: Entity): number {
  if (isPlayer(entity)) {
    const base = getBaseArmor(entity);
    return applyModifiers(entity, 'armor', base).total;
  }
  return (entity as Actor).armor;
}

// ─────────────────────────────────────────────
// Жизнь и мана (только игрок)
// ─────────────────────────────────────────────

export function getEffectiveMaxHp(player: PlayerEntity): number {
  const base = getBaseMaxHp(player);
  return applyModifiers(player, 'maxHp', base).total;
}

export function getEffectiveMaxMp(player: PlayerEntity): number {
  const base = getBaseMaxMp(player);
  return applyModifiers(player, 'maxMp', base).total;
}

// ─────────────────────────────────────────────
// Вторичные характеристики (только игрок)
// ─────────────────────────────────────────────

export function getEffectiveDodgeChance(player: PlayerEntity): number {
  const base = getBaseDodgeChance(player);
  return applyModifiers(player, 'dodgeChance', base).total;
}

export function getEffectiveAccuracy(player: PlayerEntity): number {
  const base = getBaseAccuracy(player);
  return applyModifiers(player, 'accuracy', base).total;
}

export function getEffectiveCritChance(player: PlayerEntity): number {
  const base = getBaseCritChance(player);
  return applyModifiers(player, 'critChance', base).total;
}

export function getEffectiveCritMultiplier(player: PlayerEntity): number {
  const base = getBaseCritMultiplier(player);
  return applyModifiers(player, 'critMultiplier', base).total;
}
