/**
 * Исполнитель интентов открытия, закрытия и запирания двери.
 *
 * Контракт:
 * - Мутирует состояние двери (isOpen, blocksMovement, isLocked).
 * - Порождает событие DOOR_OPENED / DOOR_CLOSED / DOOR_LOCKED / DOOR_UNLOCKED.
 *   Событие эмитится всегда, даже если дверь уже находилась в целевом состоянии
 *   (как и в исполнителях open/close).
 * - Запирание открытой двери сначала закрывает её с событием DOOR_CLOSED
 *   (как executeCloseDoorIntent), затем выставляет isLocked — эмитить
 *   CLOSE_DOOR перед LOCK_DOOR отдельным интентом не нужно.
 * - Открытие запертой двери невозможно: executeOpenDoorIntent возвращает null.
 * - World reactions могут подцепиться к этим событиям при необходимости.
 */

import type {GameState} from '@simulation/types';
import type {CloseDoorIntent, LockDoorIntent, OpenDoorIntent, UnlockDoorIntent} from '@simulation/core-types';
import {findDoorAt} from '@simulation/state';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import type {CloseDoorIntentExecutor, LockDoorIntentExecutor, OpenDoorIntentExecutor, UnlockDoorIntentExecutor} from './types';

export const executeOpenDoorIntent: OpenDoorIntentExecutor = (
  state: GameState,
  intent: OpenDoorIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const door = findDoorAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!door) return null;

  // Запертую дверь нельзя открыть: интент игнорируется, событие не порождается.
  if (door.isLocked) return null;

  door.isOpen = true;
  door.blocksMovement = false;

  return executionBuilder.addChild(parent, {
    type: 'DOOR_OPENED', isFieldEvent: true,
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
    type: 'DOOR_CLOSED', isFieldEvent: true,
    position: { x: door.x, y: door.y },
  });
};

export const executeLockDoorIntent: LockDoorIntentExecutor = (
  state: GameState,
  intent: LockDoorIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const door = findDoorAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!door) return null;

  // Запереть можно только закрытую дверь: открытая сначала закрывается
  // с событием DOOR_CLOSED, чтобы presentation увидел оба изменения.
  if (door.isOpen) {
    door.isOpen = false;
    door.blocksMovement = true;
    executionBuilder.addChild(parent, {
      type: 'DOOR_CLOSED', isFieldEvent: true,
      position: { x: door.x, y: door.y },
    });
  }
  door.isOpen = false;
  door.blocksMovement = true;
  door.isLocked = true;

  return executionBuilder.addChild(parent, {
    type: 'DOOR_LOCKED', isFieldEvent: true,
    position: { x: door.x, y: door.y },
  });
};

export const executeUnlockDoorIntent: UnlockDoorIntentExecutor = (
  state: GameState,
  intent: UnlockDoorIntent,
  executionBuilder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const door = findDoorAt(state, intent.targetPosition.x, intent.targetPosition.y);
  if (!door) return null;

  door.isLocked = false;

  return executionBuilder.addChild(parent, {
    type: 'DOOR_UNLOCKED', isFieldEvent: true,
    position: { x: door.x, y: door.y },
  });
};
