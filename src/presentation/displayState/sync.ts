/**
 * Ресинхронизация DisplayState с финальным GameState.
 *
 * Используется после завершения всех анимаций фазы, чтобы устранить
 * возможные расхождения между DisplayState и источником истины — Simulation.
 */

import type { GameState } from '@simulation/types';
import type { DisplayState } from './types';
import { buildDisplayState } from './builder';

/** Пересоздать DisplayState из финального GameState. */
export function resyncDisplayState(state: GameState): DisplayState {
  return buildDisplayState(state);
}
