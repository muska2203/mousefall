/**
 * Не-seeded источник случайности для runtime-игровой логики.
 *
 * Отличие от utils/rng.ts:
 * - использует Math.random() вместо детерминированного PRNG;
 * - не требует состояния и не мутирует GameState.rng;
 * - предназначен для игровых событий (контратака, горение, лут, ролл скиллов),
 *   которые не должны влиять на seed-генерацию мира.
 *
 * Правила:
 * - Используйте этот модуль в игровой логике (actions, world-reactions, loot,
 *   ролл скиллов предметов).
 * - Для генерации мира и всего, что должно быть seed-детерминированным,
 *   используйте utils/rng.ts и GameState.rng.
 */

/**
 * Возвращает случайное число в диапазоне [0, 1).
 */
export function randomFloat(): number {
  return Math.random();
}

/**
 * Возвращает случайное целое число в диапазоне [min, max] включительно.
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Выбирает случайный элемент из непустого массива.
 * Бросает ошибку, если массив пуст.
 */
export function randomPick<T>(array: readonly T[]): T {
  if (array.length === 0) throw new Error('randomPick: array must not be empty');
  return array[randomInt(0, array.length - 1)] as T;
}

/**
 * Перемешивает массив на месте алгоритмом Фишера–Йейтса.
 * Возвращает тот же массив (мутированный).
 */
export function randomShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [array[i], array[j]] = [array[j] as T, array[i] as T];
  }
  return array;
}

/**
 * Бросает процентный шанс.
 * Возвращает true, если случайный roll в [0, 100) меньше percent.
 *
 * @param percent - 0 = никогда, 100 = всегда
 */
export function randomChance(percent: number): boolean {
  return Math.random() * 100 < percent;
}
