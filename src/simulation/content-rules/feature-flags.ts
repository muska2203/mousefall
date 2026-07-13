/**
 * Управление feature flags для контентных правил.
 *
 * Вся работа с флагами централизована здесь, чтобы точки врезки не зависели
 * от конкретной структуры GameState.
 */

import type { GameState } from '@simulation/types.ts';

/**
 * Возвращает true, если новая система контентных правил включена.
 */
export function isContentRulesEnabled(state: GameState): boolean {
  return state.featureFlags?.contentRulesEnabled ?? false;
}

/**
 * Включает или выключает новую систему контентных правил.
 */
export function setContentRulesEnabled(state: GameState, enabled: boolean): void {
  state.featureFlags = { ...state.featureFlags, contentRulesEnabled: enabled };
}

/**
 * Гарантирует, что у состояния есть валидный блок featureFlags.
 * Используется при загрузке старых сохранений, где поле могло отсутствовать.
 */
export function ensureFeatureFlags(state: GameState): void {
  if (!state.featureFlags) {
    state.featureFlags = { contentRulesEnabled: false };
  }
}
