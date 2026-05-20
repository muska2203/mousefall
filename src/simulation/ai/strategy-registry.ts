/**
 * Реестр ИИ-стратегий.
 *
 * Ответственность:
 * - Сопоставлять строковые ID стратегий с функциями поведения в рантайме.
 * - Держать всю логику ИИ вне GameState, чтобы сохранить JSON-сериализуемость.
 *
 * Правила:
 * - GameState хранит только `aiStrategyId: string`, никогда функцию.
 * - Этот реестр — чистая таблица поиска; он не содержит изменяемого состояния.
 */

import type { AiActor, GameState } from '../types';
import type { GameAction } from '../systems/actions/types';

export type AIStrategy = {
  decideAction(actor: AiActor, state: GameState): GameAction;
};

const strategies: Record<string, AIStrategy> = {};

export function registerStrategy(id: string, strategy: AIStrategy): void {
  strategies[id] = strategy;
}

export function getStrategy(id: string): AIStrategy {
  const strategy = strategies[id];
  if (!strategy) {
    throw new Error(`Unknown AI strategy: ${id}`);
  }
  return strategy;
}

// ─────────────────────────────────────────────
// Встроенные стратегии
// ─────────────────────────────────────────────

registerStrategy('stub_right', {
  decideAction(actor) {
    return { type: 'MOVE', entityId: actor.id, dx: 1, dy: 0 };
  },
});
