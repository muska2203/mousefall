import { Entity } from '@simulation/types';
import { DamageType, GameplayTag } from '@simulation/core-types';
import { getEffectiveArmor } from '@simulation/systems/stats/effective-stats';
import { hasTag } from '@simulation/systems/tags/tag-helpers';

export type DamageCalculationContext = {
  rawDamage: number;
  damageType: DamageType;
  sourceEntityId: string | null;
  target: Entity;
  tags: GameplayTag[];
};

export type DamageTypeHandler = {
  /** Вычисляет итоговый урон после всех модификаторов типа */
  calculateDamage: (ctx: DamageCalculationContext) => number;
};

/** Стандартная логика расчёта урона: броня вычитается из урона, минимум 1.
 *  Броня применяется только к физическому урону (тег damage.physical). */
const defaultCalculateDamage = ({ rawDamage, target, tags }: DamageCalculationContext): number => {
  const armor = hasTag(tags, 'damage.physical') ? getEffectiveArmor(target) : 0;
  return Math.max(1, Math.round(rawDamage - armor));
};

const damageTypeHandlers: Record<DamageType, DamageTypeHandler> = {
  blunt: { calculateDamage: defaultCalculateDamage },
  slashing: { calculateDamage: defaultCalculateDamage },
  piercing: { calculateDamage: defaultCalculateDamage },
  fire: { calculateDamage: defaultCalculateDamage },
  electric: { calculateDamage: defaultCalculateDamage },
  poison: { calculateDamage: defaultCalculateDamage },
  frost: { calculateDamage: defaultCalculateDamage },
};

export function getDamageTypeHandler(type: DamageType): DamageTypeHandler {
  return damageTypeHandlers[type] ?? damageTypeHandlers.blunt;
}

export function registerDamageTypeHandler(type: DamageType, handler: DamageTypeHandler): void {
  damageTypeHandlers[type] = handler;
}
