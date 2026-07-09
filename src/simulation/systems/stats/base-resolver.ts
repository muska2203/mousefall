/**
 * Базовый резолвер производных характеристик.
 *
 * Ответственность:
 * - Вычисление "чистых" значений из постоянных источников:
 *   baseStats, экипировка, уровень.
 * - Не знает о временных баффах/дебаффах (это Modifier Engine).
 *
 * Правила:
 * - Все функции чистые (детерминированы, без мутаций).
 * - Для врагов не используется (у них плоские значения).
 */

import type { StatActor } from '@simulation/types.ts';
import { getItem } from '@content/registry';
import { PLAYER_BASE_MAX_HP, BASE_CRIT_MULTIPLIER } from '@utils/constants.ts';
import { getWeaponDamage } from './weapon-formulas.ts';
import { getEffectiveBaseStats } from './effective-base-stats.ts';
import type { EffectiveBaseStats } from './effective-base-stats.ts';

// ─────────────────────────────────────────────
// Effective базовые статы (с учётом +str, +dex и т.д. от экипировки)
// ─────────────────────────────────────────────

export type { EffectiveBaseStats };
export { getEffectiveBaseStats };

// ─────────────────────────────────────────────
// Жизнь
// ─────────────────────────────────────────────

export function getBaseMaxHp(actor: StatActor): number {
  const s = getEffectiveBaseStats(actor);
  // Для врагов baseMaxHp может быть задан в шаблоне; для игрока — фиксированная база.
  const base = actor.baseMaxHp ?? PLAYER_BASE_MAX_HP;
  return base + s.vit * 10;
}

// ─────────────────────────────────────────────
// Урон и броня (с учётом экипировки)
// ─────────────────────────────────────────────

export function getBaseDamage(actor: StatActor): number {
  if (actor.equippedWeaponId) {
    const weaponTemplate = getItem(actor.equippedWeaponId);
    if (weaponTemplate.type === 'weapon') {
      return getWeaponDamage(actor, weaponTemplate);
    }
  }
  // Без оружия
  return getWeaponDamage(actor, null);
}

export function getBaseArmor(actor: StatActor): number {
  if (actor.equippedArmorId) {
    const armorTemplate = getItem(actor.equippedArmorId);
    if (armorTemplate.type === 'armor' && armorTemplate.armor) {
      return armorTemplate.armor.baseArmor;
    }
  }
  return 0;
}

// ─────────────────────────────────────────────
// Вторичные характеристики (рассчитываются для StatActor)
// ─────────────────────────────────────────────

export function getBaseDodgeChance(actor: StatActor): number {
  const s = getEffectiveBaseStats(actor);
  return s.dex * 0.02;
}

export function getBaseAccuracy(actor: StatActor): number {
  const s = getEffectiveBaseStats(actor);
  return s.dex * 0.015;
}

export function getBaseCritChance(actor: StatActor): number {
  const s = getEffectiveBaseStats(actor);
  return s.dex * 0.01;
}

export function getBaseCritMultiplier(_actor: StatActor): number {
  return BASE_CRIT_MULTIPLIER;
}
