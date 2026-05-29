/**
 * Утилиты расчёта выпадения лута.
 *
 * Правила:
 * - Чистые функции, не зависят от GameState.
 * - Вся случайность через seeded RNG (utils/rng.ts).
 */

import type { RNGState } from './rng';
import { rngFloat } from './rng';

/**
 * Взвешенный случайный выбор количества предметов из таблицы дропа.
 *
 * @param lootDropTable — таблица возможных количеств с весами
 * @param rng — seeded RNG (мутируется)
 * @returns выбранное количество предметов
 */
export function rollLootDropCount(
  lootDropTable: Array<{ count: number; weight: number }>,
  rng: RNGState,
): number {
  if (lootDropTable.length === 0) return 0;

  const totalWeight = lootDropTable.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) return 0;

  let roll = rngFloat(rng) * totalWeight;
  for (const entry of lootDropTable) {
    if (entry.weight <= 0) continue;
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.count;
    }
  }

  // Fallback на последний элемент (защита от floating-point погрешности)
  return lootDropTable[lootDropTable.length - 1]!.count;
}

/**
 * Взвешенный случайный выбор предметов из таблицы лута.
 *
 * @param lootTable — таблица выпадения с весами
 * @param count — сколько предметов выбрать
 * @param rng — seeded RNG (мутируется)
 * @returns массив templateId выбранных предметов
 */
export function calculateLootDrops(
  lootTable: Array<{ templateId: string; weight: number }>,
  count: number,
  rng: RNGState,
): string[] {
  if (lootTable.length === 0 || count <= 0) return [];

  const totalWeight = lootTable.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) return [];

  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    let roll = rngFloat(rng) * totalWeight;
    let chosen = lootTable[lootTable.length - 1]!.templateId;
    for (const entry of lootTable) {
      if (entry.weight <= 0) continue;
      roll -= entry.weight;
      if (roll <= 0) {
        chosen = entry.templateId;
        break;
      }
    }
    results.push(chosen);
  }

  return results;
}
