import { Entity } from '@simulation/types';
import { DamageType } from '@simulation/core-types';
import { getEffectiveArmor } from '@simulation/systems/stats/effective-stats';

export type DamageCalculationContext = {
  rawDamage: number;
  damageType: DamageType;
  sourceEntityId: string | null;
  target: Entity;
};

export type DamageTypeHandler = {
  /** Вычисляет итоговый урон после всех модификаторов типа */
  calculateDamage: (ctx: DamageCalculationContext) => number;
};

/** Стандартная логика расчёта урона: броня вычитается из урона, минимум 1. */
const defaultCalculateDamage = ({ rawDamage, target }: DamageCalculationContext): number => {
  const armor = getEffectiveArmor(target);
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
