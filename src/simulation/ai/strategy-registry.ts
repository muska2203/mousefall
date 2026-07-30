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

import type {AiStrategyId} from '@content/ids';
import type {AiActor, GameState} from '../types';
import type {ExecutionBuilder, ExecutionNode, GameAction} from '../systems/actions/types';
import type {WorldChange} from './perception-types';

export type AIStrategy = {
  /** Обновить внутреннее состояние стратегии перед принятием решений (FSM-тики). */
  updateState?(actor: AiActor, state: GameState): void;
  /**
   * Уведомить стратегию об изменении мира.
   * Вызывается для каждого заметного события (движение, двери),
   * если актор потенциально может его воспринять (грубый фильтр по расстоянию).
   * Стратегия сама решает, видит ли актор источник изменения, и реагирует.
   */
  onWorldChange?(actor: AiActor, state: GameState, change: WorldChange): void;
  decideAction(
    actor: AiActor,
    state: GameState,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
  ): GameAction;
};

const strategies: Record<string, AIStrategy> = {};

/**
 * Регистрирует стратегию по ID из каталога `AI_STRATEGY_IDS` (src/content/ids.ts).
 * Добавление новой стратегии требует расширить каталог — компилятор подскажет.
 */
export function registerStrategy(id: AiStrategyId, strategy: AIStrategy): void {
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
