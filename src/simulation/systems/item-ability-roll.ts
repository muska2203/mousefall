import type { ItemTemplate } from '@content/schemas';
import type { RNGState } from '@simulation/types';
import { rngFloat } from '@utils/rng';

/**
 * Роллит скилл из abilityPool предмета с использованием seeded RNG.
 *
 * Детерминирован: одинаковый seed + одинаковое состояние RNG = одинаковый результат.
 * Веса entries суммируются, roll нормализуется и выбирается entry по весу.
 */
export function rollItemAbility(
  template: ItemTemplate,
  rng: RNGState,
): { templateId: string; level: number } | null {
  const pool = template.abilityPool;
  if (!pool || pool.length === 0) {
    return null;
  }

  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rngFloat(rng) * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      // TODO: реализовать логику ролла уровня (сейчас всегда 1)
      const level = 1;
      return { templateId: entry.abilityId, level };
    }
  }

  // Fallback на последний элемент (защита от floating-point погрешности)
  const last = pool[pool.length - 1]!;
  return { templateId: last.abilityId, level: 1 };
}
