/**
 * Логика перехода между этажами.
 *
 * Этот модуль не зависит от системы интентов, чтобы избежать циклических зависимостей.
 */

import type { GameState, StairsEntity, GameEvent } from '@simulation/types';
import { findStairsAt, createBoolGrid } from '@simulation/state';
import { generateMap, createStairs } from '@simulation/systems/mapgen';
import { updateFOV } from '@simulation/systems/fov';
import { MAX_FLOOR } from '@utils/constants';
import type { MapParams } from '@content/schemas';

/**
 * Выполняет атомарный переход на другой этаж.
 * Мутирует GameState напрямую.
 *
 * Возвращает объект с номерами этажей и событиями FOV для добавления в дерево ExecutionNode.
 */
export function performFloorTransition(
  state: GameState,
  direction: 'down' | 'up',
): { from: number; to: number; fovEvents: GameEvent[] } {
  // 1. Сохраняем текущий этаж
  const currentFloorEntities = Array.from(state.entities.values()).filter(e => e.id !== 'player');
  const snapshot = {
    floor: state.floor,
    map: state.map,
    entities: currentFloorEntities,
    explored: state.explored,
    rngState: state.rng.state,
  };
  state.floorSnapshots[state.floor - 1] = snapshot;

  const from = state.floor;

  // 2. Целевой этаж
  const targetFloor = direction === 'down' ? state.floor + 1 : state.floor - 1;

  // 3. Восстановление из снапшота или генерация
  const savedSnapshot = state.floorSnapshots[targetFloor - 1];

  if (savedSnapshot) {
    restoreFloorFromSnapshot(state, savedSnapshot);
  } else {
    generateNewFloor(state, targetFloor);
  }

  // 4. Позиционирование игрока
  const targetStairsTemplateId = direction === 'down' ? 'stairs_up' : 'stairs_down';
  const stairs = findStairsInState(state, targetStairsTemplateId);
  if (stairs) {
    state.player.x = stairs.x;
    state.player.y = stairs.y;
  } else {
    // Fallback: центр первой комнаты
    const firstRoom = state.map.rooms[0];
    if (firstRoom) {
      state.player.x = Math.floor(firstRoom.x + firstRoom.width / 2);
      state.player.y = Math.floor(firstRoom.y + firstRoom.height / 2);
    }
  }

  // 5. Обновление entities — игрок всегда присутствует
  state.entities.set(state.player.id, state.player);

  // 6. Пересоздание FOV
  state.visible = createBoolGrid(state.map.width, state.map.height, false);
  const fovEvents = updateFOV(state);

  // 7. Мета-состояние
  state.floor = targetFloor;
  state.turn = { activeSide: 'PLAYER', round: 1 };
  state.player.ap = state.player.maxAp;

  return { from, to: targetFloor, fovEvents };
}

function restoreFloorFromSnapshot(state: GameState, snapshot: typeof state.floorSnapshots[number]): void {
  state.map = snapshot.map;
  state.explored = snapshot.explored;
  state.entities = new Map(snapshot.entities.map(e => [e.id, e]));
}

function generateNewFloor(state: GameState, targetFloor: number): void {
  const generated = generateMap(state.mapParams, state, targetFloor, MAX_FLOOR);

  state.map = generated.map;
  state.entities = new Map();

  // Враги и предметы
  generated.enemies.forEach(e => state.entities.set(e.id, e));
  generated.items.forEach(e => state.entities.set(e.id, e));
  generated.doors.forEach(d => state.entities.set(d.id, d));

  // Лестницы
  if (generated.stairsDown && targetFloor < MAX_FLOOR) {
    state.entities.set(`stairs_down_${targetFloor}`, createStairs(state, 'stairs_down', generated.stairsDown.x, generated.stairsDown.y));
  }
  if (generated.stairsUp && targetFloor > 1) {
    state.entities.set(`stairs_up_${targetFloor}`, createStairs(state, 'stairs_up', generated.stairsUp.x, generated.stairsUp.y));
  }

  // visible и explored начинаются чистыми под фактический размер новой карты
  state.visible = createBoolGrid(state.map.width, state.map.height, false);
  state.explored = createBoolGrid(state.map.width, state.map.height, false);
}

function findStairsInState(state: GameState, templateId: string): StairsEntity | undefined {
  return Array.from(state.entities.values()).find(
    (e): e is StairsEntity => e.type === 'stairs' && e.templateId === templateId,
  );
}
