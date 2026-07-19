import {Entity} from '@simulation/types';
import type {GameplayTag} from '@simulation/core-types';
import {getEffectiveArmor} from '@simulation/systems/stats/effective-stats';
import {hasTag} from '@simulation/systems/tags/tag-helpers';

export type DamageCalculationContext = {
  rawDamage: number;
  sourceEntityId: string | null;
  target: Entity;
  tags: GameplayTag[];
};

export type DamageHandler = {
  /** Вычисляет итоговый урон после всех модификаторов типа */
  calculateDamage: (ctx: DamageCalculationContext) => number;
};

/** Стандартная логика расчёта урона: броня вычитается из урона, минимум 1.
 *  Броня применяется только к физическому урону (тег damage.physical). */
const defaultCalculateDamage = ({ rawDamage, target, tags }: DamageCalculationContext): number => {
  const armor = hasTag(tags, 'damage.physical') ? getEffectiveArmor(target) : 0;
  return Math.max(1, Math.round(rawDamage - armor));
};

const defaultHandler: DamageHandler = { calculateDamage: defaultCalculateDamage };

const damageHandlers: Array<{ predicate: (tags: GameplayTag[]) => boolean; handler: DamageHandler }> = [];

/**
 * Регистрирует обработчик урона, срабатывающий по предикату над тегами.
 */
export function registerDamageHandler(predicate: (tags: GameplayTag[]) => boolean, handler: DamageHandler): void {
  damageHandlers.push({ predicate, handler });
}

/**
 * Возвращает первый обработчик, чей предикат соответствует тегам, или стандартный.
 */
export function getDamageHandler(tags: GameplayTag[]): DamageHandler {
  for (const { predicate, handler } of damageHandlers) {
    if (predicate(tags)) {
      return handler;
    }
  }
  return defaultHandler;
}

