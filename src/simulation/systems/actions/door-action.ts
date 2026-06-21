/**
 * Обработчик действий открытия и закрытия двери.
 *
 * Контракт:
 * - OPEN_DOOR — открывает закрытую дверь на соседней клетке.
 * - CLOSE_DOOR — закрывает открытую дверь на соседней клетке,
 *   если на её клетке нет других препятствий.
 * - Действие доступно только с соседней клетки (расстояние Чебышёва ≤ 1).
 */

import type { GameState, DoorEntity, Position } from '@simulation/types';
import type { OpenDoorAction, CloseDoorAction, Intent } from '@simulation/core-types';
import { findEntity, findDoorAt, findAllEntitiesAt } from '@simulation/state';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import type { ActionHandler } from './types';

function isAdjacent(a: Position, b: Position): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

function resolveDoorActionContext(
  state: GameState,
  action: OpenDoorAction | CloseDoorAction,
  expectedOpen: boolean,
): { ok: false; reasonCode: string } | { ok: true; actor: NonNullable<ReturnType<typeof findEntity>>; door: DoorEntity } {
  const actor = findEntity(state, action.entityId);
  if (!actor) {
    return { ok: false, reasonCode: 'entity_not_exists' };
  }

  const target = action.targetPosition;
  if (!isAdjacent({ x: actor.x, y: actor.y }, target)) {
    return { ok: false, reasonCode: 'target_not_adjacent' };
  }

  const door = findDoorAt(state, target.x, target.y);
  if (!door) {
    return { ok: false, reasonCode: 'no_door_at_tile' };
  }

  if (door.isAlive === false) {
    return { ok: false, reasonCode: 'door_destroyed' };
  }

  if (door.isOpen !== expectedOpen) {
    return { ok: false, reasonCode: expectedOpen ? 'door_already_open' : 'door_already_closed' };
  }

  // При закрытии проверяем, что на клетке нет других движущихся/блокирующих сущностей.
  if (expectedOpen) {
    const hasObstacle = findAllEntitiesAt(state, target.x, target.y).some(
      (e) => e.id !== door.id && e.blocksMovement,
    );
    if (hasObstacle) {
      return { ok: false, reasonCode: 'door_tile_blocked' };
    }
  }

  return { ok: true, actor, door };
}

export const openDoorAction: ActionHandler = {
  validate(state: GameState, action) {
    if (action.type !== 'OPEN_DOOR') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }
    const ctx = resolveDoorActionContext(state, action, false);
    if (!ctx.ok) {
      return { ok: false, reasonCode: ctx.reasonCode };
    }
    return { ok: true };
  },

  resolve(state: GameState, action): Intent[] {
    if (action.type !== 'OPEN_DOOR') {
      return [];
    }
    const ctx = resolveDoorActionContext(state, action, false);
    if (!ctx.ok) {
      return [];
    }
    return [{
      type: 'OPEN_DOOR',
      entityId: action.entityId,
      targetPosition: action.targetPosition,
    }];
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder, parentNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};

export const closeDoorAction: ActionHandler = {
  validate(state: GameState, action) {
    if (action.type !== 'CLOSE_DOOR') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }
    const ctx = resolveDoorActionContext(state, action, true);
    if (!ctx.ok) {
      return { ok: false, reasonCode: ctx.reasonCode };
    }
    return { ok: true };
  },

  resolve(state: GameState, action): Intent[] {
    if (action.type !== 'CLOSE_DOOR') {
      return [];
    }
    const ctx = resolveDoorActionContext(state, action, true);
    if (!ctx.ok) {
      return [];
    }
    return [{
      type: 'CLOSE_DOOR',
      entityId: action.entityId,
      targetPosition: action.targetPosition,
    }];
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder, parentNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
