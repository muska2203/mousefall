/**
 * Форматирование рейнжей урона для UI и presentation.
 *
 * Параметр — структурный {min, max} без импорта типов simulation,
 * чтобы utils оставался независимым слоем (совместим с DamageRange).
 */

/** Форматирует рейнж урона: «2–4»; при min === max — одно число. Концы округляются. */
export function formatDamageRange(range: { min: number; max: number }): string {
  const min = Math.round(range.min);
  const max = Math.round(range.max);
  return min === max ? String(min) : `${min}–${max}`;
}
