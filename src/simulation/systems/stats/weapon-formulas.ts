/**
 * Реестр формул урона оружия.
 *
 * Каждое оружие в JSON ссылается на formulaId.
 * Формула получает владельца (StatActor) и шаблон оружия.
 */

import type {StatActor} from '@simulation/types.ts';
import type {ItemTemplate} from '@content/schemas';
import {getEffectiveBaseStats} from './effective-base-stats.ts';

export type WeaponFormula = (owner: StatActor, weapon: ItemTemplate | null) => number;

function single(damage: number): number {
  return damage;
}

const weaponFormulas: Record<string, WeaponFormula> = {
  unarmed: (owner) => {
    const s = getEffectiveBaseStats(owner);
    return single(Math.max(0, Math.round(1 + s.str)));
  },

  club: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.str * 1.5)));
  },

  dagger: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.dex * 1.2)));
  },

  staff: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.int * 0.5)));
  },

  sword: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.str * 0.8 + s.dex * 0.5)));
  },
};

/**
 * Вычисляет суммарный базовый урон для оружия.
 * Если formulaId не найден — используется unarmed.
 */
export function getWeaponDamage(owner: StatActor, weapon: ItemTemplate | null): number {
  const formulaId = weapon?.weapon?.damageFormulaId ?? 'unarmed';
  const formula = weaponFormulas[formulaId] ?? weaponFormulas.unarmed;
  return formula ? formula(owner, weapon) : 0;
}

/**
 * Регистрирует новую формулу урона (для модов или расширения).
 */
export function registerWeaponFormula(id: string, formula: WeaponFormula): void {
  weaponFormulas[id] = formula;
}

/**
 * Возвращает true, если формула урона с указанным ID зарегистрирована.
 */
export function hasWeaponFormula(id: string): boolean {
  return id in weaponFormulas;
}

/**
 * Возвращает все зарегистрированные ID формул урона.
 */
export function getAllWeaponFormulaIds(): readonly string[] {
  return Object.keys(weaponFormulas);
}
