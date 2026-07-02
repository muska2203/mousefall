/**
 * Единый обработчик взаимодействия с объектами мира.
 *
 * Контракт:
 * - `INTERACT` принимает только целевую сущность (`targetId`).
 * - Действие, которое будет выполнено, вычисляется через `resolveInteraction`.
 * - validate проверяет расстояние и специфичные ограничения (например, границы этажей).
 * - resolve пока возвращает пустой массив; конкретные intent'ы добавятся в Блоке 3.
 */

import type { GameState, Position, ValidationResult } from '@simulation/types';
import type { InteractAction, Intent } from '@simulation/core-types';
import type { ActionHandler } from './types';
import { findEntity } from '@simulation/state';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import { resolveInteraction } from '@simulation/systems/interactions/resolve-interaction.ts';
import { MAX_FLOOR } from '@utils/constants';

function isAdjacent(a: Position, b: Position): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

function isSameTile(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function resolveInteractContext(
  state: GameState,
  action: InteractAction,
): { ok: false; reasonCode: string } | { ok: true; actor: NonNullable<ReturnType<typeof findEntity>>; target: NonNullable<ReturnType<typeof findEntity>>; interaction: NonNullable<ReturnType<typeof resolveInteraction>> } {
  const actor = findEntity(state, action.entityId);
  if (!actor) {
    return { ok: false, reasonCode: 'entity_not_exists' };
  }

  const target = findEntity(state, action.targetId);
  if (!target) {
    return { ok: false, reasonCode: 'target_not_exists' };
  }

  const interaction = resolveInteraction(state, target, actor);
  if (!interaction) {
    return { ok: false, reasonCode: 'no_interaction_available' };
  }

  const actorPos = { x: actor.x, y: actor.y };
  const targetPos = { x: target.x, y: target.y };

  if (interaction.usableFromAdjacent) {
    if (!isAdjacent(actorPos, targetPos)) {
      return { ok: false, reasonCode: 'target_not_adjacent' };
    }
  } else {
    if (!isSameTile(actorPos, targetPos)) {
      return { ok: false, reasonCode: 'actor_not_on_target' };
    }
  }

  // Для лестниц дополнительно проверяем границы этажей.
  if (interaction.interactionId === 'descend' && state.floor >= MAX_FLOOR) {
    return { ok: false, reasonCode: 'max_floor_reached' };
  }
  if (interaction.interactionId === 'ascend' && state.floor <= 1) {
    return { ok: false, reasonCode: 'min_floor_reached' };
  }

  return { ok: true, actor, target, interaction };
}

export const interactAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'INTERACT') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }

    const ctx = resolveInteractContext(state, action);
    if (!ctx.ok) {
      return { ok: false, reasonCode: ctx.reasonCode };
    }

    return { ok: true };
  },

  resolve(_state: GameState, _action): Intent[] {
    // Блок 1: пока не порождаем конкретные intent'ы.
    return [];
  },

  execute(state: GameState, _action, intents: Intent[], executionBuilder, parentNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
