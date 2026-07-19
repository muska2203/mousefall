import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode, GameAction, Intent, ValidationResult,} from "@simulation/core-types.ts";

// Реэкспорт базовых типов для обратной совместимости потребителей
export { ExecutionBuilder } from "@simulation/core-types.ts";
export type {
  ExecutionNode,
  GameAction,
  Intent,
  ValidationResult,
  TargetMode,
  AttackAction,
  UseAbilityAction,
} from "@simulation/core-types.ts";

/** Обработчик игрового действия.
 *
 * Хендлер получает `action: GameAction` и должен сам выполнить narrowing
 * через проверку `action.type`, если ему нужен конкретный подтип.
 */
export type ActionHandler = {
  validate(state: GameState, action: GameAction): ValidationResult;

  resolve(state: GameState, action: GameAction): Intent[];

  execute(state: GameState, action: GameAction, intents: Intent[], executionBuilder: ExecutionBuilder, parent: ExecutionNode): void;
}
