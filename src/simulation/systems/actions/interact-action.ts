/**
 * Единый обработчик взаимодействия с объектами мира.
 *
 * Контракт:
 * - `INTERACT` принимает только целевую сущность (`targetId`).
 * - Действие, которое будет выполнено, вычисляется через `resolveInteraction`.
 * - validate проверяет расстояние, состояние цели и специфичные ограничения
 *   (границы этажей, препятствия при закрытии двери).
 * - resolve порождает конкретный intent: OPEN_DOOR, CLOSE_DOOR, PICK_UP или FLOOR_TRANSITION.
 */

import type { GameState, Position, ValidationResult, FloorItemContainerEntity } from '@simulation/types';
import type { InteractAction, Intent } from '@simulation/core-types';
import type { ActionHandler } from './types';
import { findEntity, findDoorAt, findAllEntitiesAt } from '@simulation/state';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import { resolveInteraction } from '@simulation/systems/interactions/resolve-interaction.ts';
import { MAX_FLOOR } from '@utils/constants';

function isAdjacent(a: Position, b: Position): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

function isSameTile(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

type ResolvedContext =
  | { ok: false; reasonCode: string }
  | {
      ok: true;
      actor: NonNullable<ReturnType<typeof findEntity>>;
      target: NonNullable<ReturnType<typeof findEntity>>;
      interaction: NonNullable<ReturnType<typeof resolveInteraction>>;
    };

function resolveInteractContext(
  state: GameState,
  action: InteractAction,
): ResolvedContext {
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

function validateInteractionSpecifics(
  state: GameState,
  actor: NonNullable<ReturnType<typeof findEntity>>,
  target: NonNullable<ReturnType<typeof findEntity>>,
  interaction: NonNullable<ReturnType<typeof resolveInteraction>>,
): ValidationResult {
  switch (interaction.interactionId) {
    case 'open_door':
    case 'close_door': {
      const door = findDoorAt(state, target.x, target.y);
      if (!door) {
        return { ok: false, reasonCode: 'no_door_at_tile' };
      }
      if (door.isAlive === false) {
        return { ok: false, reasonCode: 'door_destroyed' };
      }
      const expectedOpen = interaction.interactionId === 'close_door';
      if (door.isOpen !== expectedOpen) {
        return { ok: false, reasonCode: expectedOpen ? 'door_already_closed' : 'door_already_open' };
      }
      // При закрытии двери нельзя стоять на её клетке и на ней не должно быть других препятствий.
      if (interaction.interactionId === 'close_door') {
        if (actor.x === target.x && actor.y === target.y) {
          return { ok: false, reasonCode: 'cannot_close_door_from_inside' };
        }
        const hasObstacle = findAllEntitiesAt(state, target.x, target.y).some(
          (e) => e.id !== door.id && e.blocksMovement,
        );
        if (hasObstacle) {
          return { ok: false, reasonCode: 'door_tile_blocked' };
        }
      }
      return { ok: true };
    }

    case 'pickup': {
      if (target.type !== 'floor_item_container') {
        return { ok: false, reasonCode: 'not_an_item_container' };
      }
      return { ok: true };
    }

    case 'descend':
    case 'ascend': {
      if (actor.id !== 'player') {
        return { ok: false, reasonCode: 'only_player_can_transition' };
      }
      if (target.type !== 'stairs') {
        return { ok: false, reasonCode: 'not_stairs' };
      }
      return { ok: true };
    }

    default:
      return { ok: false, reasonCode: 'unsupported_interaction' };
  }
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

    return validateInteractionSpecifics(state, ctx.actor, ctx.target, ctx.interaction);
  },

  resolve(state: GameState, action): Intent[] {
    if (action.type !== 'INTERACT') {
      return [];
    }

    const ctx = resolveInteractContext(state, action);
    if (!ctx.ok) {
      return [];
    }

    const { target, interaction } = ctx;

    switch (interaction.interactionId) {
      case 'open_door':
        return [{
          type: 'OPEN_DOOR',
          entityId: action.entityId,
          targetPosition: { x: target.x, y: target.y },
        }];

      case 'close_door':
        return [{
          type: 'CLOSE_DOOR',
          entityId: action.entityId,
          targetPosition: { x: target.x, y: target.y },
        }];

      case 'pickup': {
        const container = target as FloorItemContainerEntity;
        return [{
          type: 'PICK_UP',
          entityId: action.entityId,
          itemId: target.id,
          templateId: container.item.templateId,
        }];
      }

      case 'descend':
      case 'ascend':
        return [{
          type: 'FLOOR_TRANSITION',
          entityId: action.entityId,
          direction: interaction.interactionId === 'descend' ? 'down' : 'up',
        }];

      default:
        return [];
    }
  },

  execute(state: GameState, _action, intents: Intent[], executionBuilder, parentNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
