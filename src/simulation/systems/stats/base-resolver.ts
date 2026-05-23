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

import type { PlayerEntity } from '@simulation/types.ts';
import { getItem } from '@simulation/content/registry.ts';
import { getWeaponDamage } from './weapon-formulas.ts';
import { applyModifiers } from './modifier-engine.ts';

// ─────────────────────────────────────────────
// Effective базовые статы (с учётом +str, +dex и т.д. от экипировки)
// ─────────────────────────────────────────────

export type EffectiveBaseStats = {
  str: number;
  dex: number;
  int: number;
  vit: number;
};

export function getEffectiveBaseStats(player: PlayerEntity): EffectiveBaseStats {
  return {
    str: applyModifiers(player, 'str', player.baseStats.str).total,
    dex: applyModifiers(player, 'dex', player.baseStats.dex).total,
    int: applyModifiers(player, 'int', player.baseStats.int).total,
    vit: applyModifiers(player, 'vit', player.baseStats.vit).total,
  };
}

// ─────────────────────────────────────────────
// Жизнь и мана
// ─────────────────────────────────────────────

export function getBaseMaxHp(player: PlayerEntity): number {
  const s = getEffectiveBaseStats(player);
  return 50 + s.vit * 10;
}

export function getBaseMaxMp(player: PlayerEntity): number {
  const s = getEffectiveBaseStats(player);
  return 20 + s.int * 5;
}

// ─────────────────────────────────────────────
// Урон и броня (с учётом экипировки)
// ─────────────────────────────────────────────

export function getBaseDamage(player: PlayerEntity): number {
  if (player.equippedWeaponId) {
    const weaponTemplate = getItem(player.equippedWeaponId);
    if (weaponTemplate.type === 'weapon') {
      return getWeaponDamage(player, weaponTemplate);
    }
  }
  // Без оружия
  return getWeaponDamage(player, null);
}

export function getBaseArmor(player: PlayerEntity): number {
  if (player.equippedArmorId) {
    const armorTemplate = getItem(player.equippedArmorId);
    if (armorTemplate.type === 'armor' && armorTemplate.armor) {
      return armorTemplate.armor.baseArmor;
    }
  }
  return 0;
}

// ─────────────────────────────────────────────
// Вторичные характеристики
// ─────────────────────────────────────────────

export function getBaseDodgeChance(player: PlayerEntity): number {
  const s = getEffectiveBaseStats(player);
  return s.dex * 0.02;
}

export function getBaseAccuracy(player: PlayerEntity): number {
  const s = getEffectiveBaseStats(player);
  return s.dex * 0.015;
}

export function getBaseCritChance(player: PlayerEntity): number {
  const s = getEffectiveBaseStats(player);
  return s.dex * 0.01;
}

export function getBaseCritMultiplier(_player: PlayerEntity): number {
  return 1.5;
}
