/**
 * Миграция загруженных сохранений: гарантирует наличие runtimeRng.
 *
 * Старые сохранения могут не содержать отдельный RNG для игровых событий.
 * Если поле отсутствует, создаём его на основе seed мирового RNG,
 * чтобы роллы шансов контентных правил оставались детерминированными.
 */

import type { GameState } from '@simulation/types.ts';
import { createRNG } from '@utils/rng.ts';

/**
 * Гарантирует, что у состояния есть runtimeRng.
 * При отсутствии инициализирует его тем же seed, что и state.rng.
 */
export function ensureRuntimeRng(state: GameState): void {
  if (!state.runtimeRng) {
    state.runtimeRng = createRNG(state.rng.seed);
  }
}
