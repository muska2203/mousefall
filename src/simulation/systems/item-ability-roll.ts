import type {ItemTemplate} from '@content/schemas';
import {randomFloat} from '@utils/random';

/**
 * Роллит скилл из abilityPool предмета с использованием runtime random.
 *
 * Результат не зависит от seed мира: одинаковый предмет в одинаковой геометрии
 * уровня может получить разные скиллы между забегами.
 * Веса entries суммируются, roll нормализуется и выбирается entry по весу.
 */
export function rollItemAbility(
  template: ItemTemplate,
): { templateId: string; level: number } | null {
  const pool = template.abilityPool;
  if (!pool || pool.length === 0) {
    return null;
  }

  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = randomFloat() * totalWeight;

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
