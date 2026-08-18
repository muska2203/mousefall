/**
 * Сортировка статус-эффектов для отображения в UI.
 *
 * Порядок отображения — чисто визуальный: самые заметные/важные
 * эффекты идут первыми. Сортировка живёт в слое Presentation,
 * потому что это решение о том, как данные Simulation представляются в UI.
 */

import type {StatusEffect} from '@simulation/types';

/** Порядок отображения статус-эффектов в слотах. Меньше — левее. */
const STATUS_DISPLAY_ORDER: Record<string, number> = {
  stunned: 0,
  bulwark: 1,
  rooted: 2,
  burning: 3,
  bleeding: 4,
  poisoned: 5,
  frozen: 6,
  counterattack: 7,
  regenerating: 8,
  silenced: 9,
};

/** Сортирует эффекты по фиксированному порядку отображения. */
export function sortStatusEffects(effects: readonly StatusEffect[]): readonly StatusEffect[] {
  return [...effects].sort((a, b) => {
    const orderA = STATUS_DISPLAY_ORDER[a.type] ?? Number.MAX_SAFE_INTEGER;
    const orderB = STATUS_DISPLAY_ORDER[b.type] ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}
