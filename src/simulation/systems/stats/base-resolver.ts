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

import type {StatActor} from '@simulation/types.ts';
import type {DamageRange} from '@simulation/core-types.ts';
import {getItem, tryGetItem} from '@content/registry';
import {BASE_CRIT_MULTIPLIER, PLAYER_BASE_MAX_HP} from '@utils/constants.ts';
import type {EffectiveBaseStats} from './effective-base-stats.ts';
import {getEffectiveBaseStats} from './effective-base-stats.ts';

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

/** Рейнж урона безоружной атаки, если шаблон unarmed недоступен в реестре. */
const UNARMED_DAMAGE_RANGE: DamageRange = { min: 1, max: 1 };

/**
 * Возвращает базовый рейнж урона оружия актора.
 * Берётся из шаблона экипированного оружия; без оружия — из шаблона unarmed
 * (fallback {1,1}, если реестр недоступен).
 */
export function getBaseDamageRange(actor: StatActor): DamageRange {
  if (actor.equippedWeaponId) {
    const weaponTemplate = getItem(actor.equippedWeaponId);
    if (weaponTemplate.type === 'weapon' && weaponTemplate.weapon) {
      return { ...weaponTemplate.weapon.damage };
    }
  }
  // Без оружия — рейнж безоружной атаки.
  const unarmed = tryGetItem('unarmed');
  if (unarmed?.type === 'weapon' && unarmed.weapon) {
    return { ...unarmed.weapon.damage };
  }
  return { ...UNARMED_DAMAGE_RANGE };
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

export function getBaseCritMultiplier(_actor: StatActor): number {
  return BASE_CRIT_MULTIPLIER;
}
