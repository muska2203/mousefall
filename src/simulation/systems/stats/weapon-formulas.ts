/**
 * Реестр формул урона оружия.
 *
 * Каждое оружие в JSON ссылается на formulaId.
 * Формула получает владельца (PlayerEntity) и шаблон оружия.
 */

import type { PlayerEntity } from '@simulation/types.ts';
import type { ItemTemplate } from '@simulation/schemas/contentSchemas.ts';
import { getEffectiveBaseStats } from './base-resolver.ts';

export type WeaponFormula = (owner: PlayerEntity, weapon: ItemTemplate | null) => number;

const weaponFormulas: Record<string, WeaponFormula> = {
  unarmed: (owner) => {
    const s = getEffectiveBaseStats(owner);
    return 1 + s.str * 1.0;
  },

  club: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    return weapon.weapon!.baseDamage + s.str * 1.5;
  },

  dagger: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    return weapon.weapon!.baseDamage + s.dex * 1.2;
  },

  staff: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    return weapon.weapon!.baseDamage + s.int * 1.8;
  },

  sword: (owner, weapon) => {
    if (!weapon) return 0;
    const s = getEffectiveBaseStats(owner);
    return weapon.weapon!.baseDamage + s.str * 0.8 + s.dex * 0.5;
  },
};

/**
 * Вычисляет базовый урон для оружия по формуле.
 * Если formulaId не найден — используется unarmed.
 */
export function getWeaponDamage(owner: PlayerEntity, weapon: ItemTemplate | null): number {
  const formulaId = weapon?.weapon?.damageFormulaId ?? 'unarmed';
  const formula = weaponFormulas[formulaId] ?? weaponFormulas.unarmed;
  if (!formula) return 0;
  return Math.max(0, Math.round(formula(owner, weapon)));
}

/**
 * Регистрирует новую формулу урона (для модов или расширения).
 */
export function registerWeaponFormula(id: string, formula: WeaponFormula): void {
  weaponFormulas[id] = formula;
}
