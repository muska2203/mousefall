/**
 * Исполнитель интентов открытия и закрытия двери.
 *
 * Контракт:
 * - Мутирует состояние двери (isOpen, blocksMovement).
 * - Порождает событие DOOR_OPENED / DOOR_CLOSED.
 * - World reactions могут подцепиться к этим событиям при необходимости.
 */

import type {GameState} from '@simulation/types';
import type {CloseDoorIntent, OpenDoorIntent} from '@simulation/core-types';
import {findDoorAt} from '@simulation/state';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {CloseDoorIntentExecutor, OpenDoorIntentExecutor} from './types';

export const executeOpenDoorIntent: OpenDoorIntentExecutor = (
  state: GameState,
  intent: OpenDoorIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const door = findDoorAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!door) return null;

  door.isOpen = true;
  door.blocksMovement = false;

  return executionBuilder.addChild(parent, {
    type: 'DOOR_OPENED',
    position: { x: door.x, y: door.y },
  });
};

export const executeCloseDoorIntent: CloseDoorIntentExecutor = (
  state: GameState,
  intent: CloseDoorIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const door = findDoorAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!door) return null;

  door.isOpen = false;
  door.blocksMovement = true;

  return executionBuilder.addChild(parent, {
    type: 'DOOR_CLOSED',
    position: { x: door.x, y: door.y },
  });
};
