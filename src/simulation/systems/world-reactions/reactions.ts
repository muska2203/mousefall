import {GameEvent, GameState} from "@simulation/types.ts";
import {WorldReaction} from "@simulation/systems/world-reactions/types.ts";
import {ExecutionBuilder, ExecutionNode, Intent} from "@simulation/core-types.ts";
import {deathReaction} from "@simulation/systems/world-reactions/death-reaction.ts";
import {postDeathLootReaction} from "@simulation/systems/world-reactions/post-death-loot-reaction.ts";
import {fireDamageReaction} from "@simulation/systems/world-reactions/fire-damage-reaction.ts";
import {collisionDamageReaction} from "@simulation/systems/world-reactions/collision-damage-reaction.ts";
import {collisionStunReaction} from "@simulation/systems/world-reactions/collision-stun-reaction.ts";
import {displacementMoveReaction} from "@simulation/systems/world-reactions/displacement-move-reaction.ts";
import {burningTickReaction} from "@simulation/systems/world-reactions/burning-tick-reaction.ts";
import {floorTransitionReaction} from "@simulation/systems/world-reactions/floor-transition-reaction.ts";
import {aiPerceptionReaction} from "@simulation/systems/world-reactions/ai-perception-reaction.ts";
import {counterAttackReaction} from "@simulation/systems/world-reactions/counter-attack-reaction.ts";

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
): Intent[] {
  const entries = worldReactions.get(executedNode.event.type) ?? [];
  const intents: Intent[] = [];

  for (const entry of entries) {
    const result = entry.handler(state, executedNode.event, builder, executedNode);
    intents.push(...result);
  }

  return intents;
}

// ─────────────────────────────────────────────
// Встроенные реакции
// ─────────────────────────────────────────────

registerReaction('ENTITY_DISPLACED', displacementMoveReaction, 0);
registerReaction('ENTITY_COLLIDED', collisionDamageReaction, 0);
registerReaction('ENTITY_COLLIDED', collisionStunReaction, 1);
registerReaction('STATUS_TICKED', burningTickReaction, 0);
registerReaction('ENTITY_DAMAGED', fireDamageReaction, -1);
registerReaction('ENTITY_DAMAGED', deathReaction, 0);
registerReaction('ENTITY_DAMAGED', counterAttackReaction, 1);
registerReaction('ENTITY_DIED', postDeathLootReaction, 0);
registerReaction('FLOOR_CHANGED', floorTransitionReaction, 0);
registerReaction('ENTITY_MOVED', aiPerceptionReaction, 0);
registerReaction('DOOR_OPENED', aiPerceptionReaction, 0);
registerReaction('DOOR_CLOSED', aiPerceptionReaction, 0);
registerReaction('COUNTER_ATTACK_APPLIED', counterAttackReaction, 0);
