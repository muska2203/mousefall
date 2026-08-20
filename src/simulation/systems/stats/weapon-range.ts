/**
 * Дальности базовой атаки оружия (minRange/range).
 *
 * Читаются из шаблона экипированного оружия через реестр контента.
 * Безоружная атака и сущности без StatActor считаются рукопашными (1..1).
 * Модификаторы на дальность атаки не существуют — значения плоские из шаблона.
 */

import type {Entity} from '@simulation/types.ts';
import type {Position} from '@simulation/core-types.ts';
import {tryGetItem} from '@content/registry';
import {isStatActor} from './effective-stats.ts';

/** Дальности базовой атаки: [minRange, range] в клетках (дистанция Чебышёва). */
export interface WeaponAttackRange {
  minRange: number;
  range: number;
}

/** Дальности рукопашной/безоружной атаки по умолчанию. */
const UNARMED_ATTACK_RANGE: WeaponAttackRange = { minRange: 1, range: 1 };

/**
 * Возвращает дальности базовой атаки актора из шаблона экипированного оружия.
 * Без оружия читает шаблон unarmed; при недоступности реестра — fallback {1, 1}.
 * Для не-StatActor всегда возвращает рукопашные дальности {1, 1}.
 */
export function getWeaponAttackRange(entity: Entity): WeaponAttackRange {
  if (!isStatActor(entity)) {
    return { ...UNARMED_ATTACK_RANGE };
  }

  const templateId = entity.equippedWeaponId ?? 'unarmed';
  const template = tryGetItem(templateId);
  if (template?.type === 'weapon' && template.weapon) {
    return {
      minRange: template.weapon.minRange,
      range: template.weapon.range,
    };
  }

  return { ...UNARMED_ATTACK_RANGE };
}

/**
 * Общий предикат дальности базовой атаки: клетка `to` в зоне досягаемости из `from`,
 * если дистанция Чебышёва ∈ [minRange, range]. Метрика едина с движением
 * в 8 направлений и FOV: рукопашное оружие (minRange 1, range 1) бьёт все 8
 * соседних клеток, а оружие с minRange 2 не бьёт ни по одной из них.
 */
export function isInWeaponRange(attackRange: WeaponAttackRange, from: Position, to: Position): boolean {
  const chebyshev = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  return chebyshev >= attackRange.minRange && chebyshev <= attackRange.range;
}

/**
 * Радиус FOV, достаточный для LOS-проверки всех клеток по предикату `isInWeaponRange`.
 * FOV квадратный (Чебышёв), поэтому радиус совпадает с дальностью оружия.
 */
export function getWeaponAttackLosRadius(attackRange: WeaponAttackRange): number {
  return attackRange.range;
}
