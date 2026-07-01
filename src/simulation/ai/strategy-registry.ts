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
import type { ExecutionBuilder, ExecutionNode } from '../systems/actions/types';

export type AIStrategy = {
  /** Обновить внутреннее состояние стратегии перед принятием решений (FSM-тики). */
  updateState?(actor: AiActor, state: GameState): void;
  decideAction(
    actor: AiActor,
    state: GameState,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
  ): GameAction;
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

// Стратегии регистрируются в отдельных файлах через side-effect import.
// См. hunter-strategy.ts и simulation.ts
