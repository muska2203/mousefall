/**
 * Контроллер запирания босс-комнаты (roadMap 1.3).
 *
 * Подписан на ENTITY_MOVED (перемещения игрока) и ENTITY_DIED (смерть босса):
 * - Вход игрока в босс-комнату при живом боссе внутри → двери босс-комнаты
 *   запираются (LOCK_DOOR; открытая дверь закрывается исполнителем с DOOR_CLOSED).
 * - Выход игрока из комнаты при живом боссе → двери отпираются (UNLOCK_DOOR),
 *   босс преследует существующим hunter-FSM.
 * - Смерть последнего босса на этаже → двери отпираются насовсем:
 *   повторный вход не запирает, т.к. живых боссов больше нет.
 *
 * Босс-комната находится по `state.map.rooms` + `state.mapParams.bossRoomTypeId`;
 * двери — по тегу `boss_room` в шаблоне двери (реестр контента), поэтому
 * топологию этажа в состояние протягивать не нужно.
 */

import type {Intent} from '@simulation/core-types';
import type {DoorEntity, Entity, GameState, Position, Room} from '@simulation/types';
import {findEntity} from '@simulation/state';
import {tryGetDoor} from '@content/registry';
import {isBossTemplate} from '@simulation/systems/bossTracking';
import {PLAYER_ID} from '@utils/constants';
import type {WorldReaction} from './types';

/** Contains-проверка точки в прямоугольнике комнаты. */
function isInsideRoom(room: Room, pos: Position): boolean {
  return pos.x >= room.x && pos.x < room.x + room.width
      && pos.y >= room.y && pos.y < room.y + room.height;
}

/** Босс-комната этажа или undefined (карта без bossPool). */
function findBossRoom(state: GameState): Room | undefined {
  return state.map.rooms.find((room) => room.roomTypeId === state.mapParams.bossRoomTypeId);
}

/** Живые двери босс-комнаты (тег `boss_room` в шаблоне двери). */
function findBossRoomDoors(state: GameState): DoorEntity[] {
  const doors: DoorEntity[] = [];
  for (const entity of state.entities.values()) {
    if (entity.type !== 'door' || !entity.isAlive) continue;
    if (tryGetDoor(entity.templateId)?.tags.includes('boss_room')) {
      doors.push(entity);
    }
  }
  return doors;
}

/** true, если сущность — живой босс (флаг `isBoss` в шаблоне сущности). */
function isAliveBoss(entity: Entity): boolean {
  return 'templateId' in entity
      && 'isAlive' in entity
      && entity.isAlive
      && isBossTemplate(entity.templateId);
}

function makeUnlockIntents(doors: DoorEntity[]): Intent[] {
  return doors.map((door) => ({
    type: 'UNLOCK_DOOR' as const,
    entityId: PLAYER_ID,
    targetPosition: {x: door.x, y: door.y},
  }));
}

/**
 * Реакция на перемещение игрока: запирание при входе в босс-комнату,
 * отпирание при выходе (пока жив хоть один босс).
 */
export const bossRoomDoorReaction: WorldReaction = (
  state,
  event,
  _builder,
  _parent,
) => {
  if (event.type !== 'ENTITY_MOVED') return [];

  // Реагируем только на перемещения игрока.
  const mover = findEntity(state, event.entityId);
  if (!mover || mover.type !== 'player') return [];

  const bossRoom = findBossRoom(state);
  if (!bossRoom) return [];

  const fromInside = isInsideRoom(bossRoom, event.from);
  const toInside = isInsideRoom(bossRoom, event.to);
  if (fromInside === toInside) return [];

  const doors = findBossRoomDoors(state);
  if (doors.length === 0) return [];

  if (toInside) {
    // Вход: запираем, только если внутри комнаты есть живой босс —
    // иначе босс, вышедший из комнаты (преследование), застрянет снаружи.
    const hasAliveBossInside = Array.from(state.entities.values()).some(
      (entity) => isAliveBoss(entity) && isInsideRoom(bossRoom, entity),
    );
    if (!hasAliveBossInside) return [];

    const intents: Intent[] = [];
    for (const door of doors) {
      // LOCK_DOOR эмитится безусловно: повторный вход при уже запертых
      // дверях идемпотентен (исполнитель просто подтверждает состояние),
      // а открытую дверь исполнитель закрывает сам с событием DOOR_CLOSED.
      intents.push({
        type: 'LOCK_DOOR',
        entityId: PLAYER_ID,
        targetPosition: {x: door.x, y: door.y},
      });
    }
    return intents;
  }

  // Выход: отпираем, пока жив хоть один босс (где угодно на этаже).
  // Отпирание после смерти всех боссов — задача bossRoomUnlockOnBossDeathReaction.
  const hasAliveBoss = Array.from(state.entities.values()).some(isAliveBoss);
  if (!hasAliveBoss) return [];

  return makeUnlockIntents(doors);
};

/**
 * Реакция на смерть босса: если живых боссов на этаже не осталось,
 * двери босс-комнаты отпираются насовсем.
 */
export const bossRoomUnlockOnBossDeathReaction: WorldReaction = (
  state,
  event,
  _builder,
  _parent,
) => {
  if (event.type !== 'ENTITY_DIED') return [];

  const entity = findEntity(state, event.entityId);
  if (!entity || !('templateId' in entity) || !isBossTemplate(entity.templateId)) return [];

  // К моменту события умерший уже isAlive=false (die-intent-executer
  // выставляет флаг до эмита ENTITY_DIED), поэтому достаточно проверить,
  // что других живых боссов на этаже нет.
  const hasAliveBoss = Array.from(state.entities.values()).some(isAliveBoss);
  if (hasAliveBoss) return [];

  return makeUnlockIntents(findBossRoomDoors(state));
};
