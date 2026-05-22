import {GameEvent, GameState} from "@simulation/types.ts";
import {WorldReaction} from "@simulation/systems/world-reactions/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {deathReaction} from "@simulation/systems/world-reactions/death-reaction.ts";
import {stairsTransitionReaction} from "@simulation/systems/world-reactions/stairs-reaction.ts";

// ─────────────────────────────────────────────
// Хранилище реакций
// ─────────────────────────────────────────────

type ReactionEntry = {
  handler: WorldReaction;
  priority: number;
};

const worldReactions = new Map<string, ReactionEntry[]>();

// ─────────────────────────────────────────────
// Регистрация
// ─────────────────────────────────────────────

/**
 * Регистрирует реакцию мира на событие заданного типа.
 * Реакции с меньшим priority выполняются раньше.
 * Позволяет модулям и модам добавлять реакции без изменения ядра.
 */
export function registerReaction(
  eventType: GameEvent['type'],
  handler: WorldReaction,
  priority: number = 0,
): void {
  const entries = worldReactions.get(eventType) ?? [];
  entries.push({ handler, priority });
  entries.sort((a, b) => a.priority - b.priority);
  worldReactions.set(eventType, entries);
}

// ─────────────────────────────────────────────
// Выполнение
// ─────────────────────────────────────────────

export function runWorldReactions(
  state: GameState,
  builder: ExecutionBuilder,
  executedNode: ExecutionNode,
) {
  const entries = worldReactions.get(executedNode.event.type) ?? [];

  for (const entry of entries) {
    entry.handler(state, executedNode.event, builder, executedNode);
  }
}

// ─────────────────────────────────────────────
// Встроенные реакции
// ─────────────────────────────────────────────

registerReaction('ENTITY_MOVED', stairsTransitionReaction, 0);
registerReaction('ENTITY_DAMAGED', deathReaction, 0);
