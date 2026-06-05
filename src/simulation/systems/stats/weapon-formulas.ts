/**
 * Реестр формул урона оружия.
 *
 * Каждое оружие в JSON ссылается на formulaId.
 * Формула получает владельца (PlayerEntity) и шаблон оружия.
 */

import type { StatActor } from '@simulation/types.ts';
import type { ItemTemplate } from '@content/schemas';
import type { DamageType } from '@simulation/core-types.ts';
import { getEffectiveBaseStats } from './base-resolver.ts';

export type WeaponDamageEntry = {
  damage: number;
  damageType: DamageType;
};

export type WeaponFormula = (owner: StatActor, weapon: ItemTemplate | null) => WeaponDamageEntry[];

function single(damage: number, damageType: DamageType): WeaponDamageEntry[] {
  return [{ damage, damageType }];
}

const weaponFormulas: Record<string, WeaponFormula> = {
  unarmed: (owner) => {
    const s = getEffectiveBaseStats(owner);
    return single(Math.max(0, Math.round(1 + s.str * 1.0)), 'blunt');
  },

  club: (owner, weapon) => {
    if (!weapon) return [];
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.str * 1.5)), weapon.weapon!.damageType ?? 'blunt');
  },

  dagger: (owner, weapon) => {
    if (!weapon) return [];
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.dex * 1.2)), weapon.weapon!.damageType ?? 'piercing');
  },

  staff: (owner, weapon) => {
    if (!weapon) return [];
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.int * 0.5)), weapon.weapon!.damageType ?? 'blunt');
  },

  sword: (owner, weapon) => {
    if (!weapon) return [];
    const s = getEffectiveBaseStats(owner);
    const base = weapon.weapon!.baseDamage ?? 0;
    return single(Math.max(0, Math.round(base + s.str * 0.8 + s.dex * 0.5)), weapon.weapon!.damageType ?? 'slashing');
  },
};

/**
 * Вычисляет записи урона для оружия по формуле.
 * Если formulaId не найден — используется unarmed.
 */
export function getWeaponDamageEntries(owner: StatActor, weapon: ItemTemplate | null): WeaponDamageEntry[] {
  const entries = weapon?.weapon?.damageEntries;
  if (entries && entries.length > 0) {
    const result: WeaponDamageEntry[] = [];
    for (const entry of entries) {
      if (!weapon.weapon) continue;
      const formulaId = entry.damageFormulaId ?? weapon.weapon.damageFormulaId ?? 'unarmed';
      const formula = weaponFormulas[formulaId] ?? weaponFormulas.unarmed;
      if (!formula) continue;
      // Формула возвращает массив, но для кастомных damageEntries
      // мы применяем формулу к baseDamage конкретной записи.
      const tempWeapon: ItemTemplate = {
        ...weapon,
        weapon: { ...weapon.weapon, baseDamage: entry.baseDamage },
      };
      const computed = formula(owner, tempWeapon);
      // Если формула вернула один элемент с тем же типом — используем его,
      // иначе берем сумму и перезаписываем тип.
      const totalDamage = computed.reduce((sum, e) => sum + e.damage, 0);
      result.push({ damage: totalDamage, damageType: entry.damageType });
    }
    return result;
  }

  const formulaId = weapon?.weapon?.damageFormulaId ?? 'unarmed';
  const formula = weaponFormulas[formulaId] ?? weaponFormulas.unarmed;
  if (!formula) return [];
  return formula(owner, weapon);
}

/**
 * Вычисляет суммарный базовый урон для оружия (для UI).
 */
export function getWeaponDamage(owner: StatActor, weapon: ItemTemplate | null): number {
  return getWeaponDamageEntries(owner, weapon).reduce((sum, e) => sum + e.damage, 0);
}

/**
 * Регистрирует новую формулу урона (для модов или расширения).
 */
export function registerWeaponFormula(id: string, formula: WeaponFormula): void {
  weaponFormulas[id] = formula;
}
