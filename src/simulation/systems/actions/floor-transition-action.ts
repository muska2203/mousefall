/**
 * Логика перехода между этажами.
 *
 * Action handlers DESCEND / ASCEND выполняют переход через performFloorTransition.
 * WorldReaction stairsTransitionReaction только обнаруживает лестницу и порождает
 * STAIR_EXIT_TRIGGERED — решение о переходе принимает Presentation.
 */

import type { GameState, StairsEntity, GameEvent, ValidationResult } from '@simulation/types';
import { ActionHandler, ExecutionBuilder, ExecutionNode } from './types';
import { findStairsAt, createBoolGrid } from '@simulation/state';
import { generateMap, createStairs } from '@simulation/systems/mapgen';
import { updateFOV } from '@simulation/systems/fov';
import { MAX_FLOOR } from '@utils/constants';
import type { MapParams } from '@simulation/schemas/contentSchemas';


// ─────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────

export const descendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'DESCEND') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected DESCEND action' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player', reasonDescription: 'Только игрок может спускаться' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'down');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_down', reasonDescription: 'Здесь нет спуска вниз' };
    }

    if (state.floor >= MAX_FLOOR) {
      return { ok: false, reasonCode: 'max_floor_reached', reasonDescription: 'Достигнут нижний этаж подземелья' };
    }

    return { ok: true };
  },

  resolve(): [] {
    return [];
  },

  execute(
    state: GameState,
    _action,
    _intents: [],
    executionBuilder: ExecutionBuilder,
    parentNode: ExecutionNode,
  ): void {
    const from = state.floor;
    const result = performFloorTransition(state, 'down');
    executionBuilder.addChild(parentNode, {
      type: 'FLOOR_CHANGED',
      from,
      to: result.to,
    });
    for (const fovEvent of result.fovEvents) {
      executionBuilder.addChild(parentNode, fovEvent);
    }
  },
};

export const ascendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'ASCEND') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected ASCEND action' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player', reasonDescription: 'Только игрок может подниматься' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'up');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_up', reasonDescription: 'Здесь нет подъёма вверх' };
    }

    if (state.floor <= 1) {
      return { ok: false, reasonCode: 'min_floor_reached', reasonDescription: 'Вы уже на поверхности' };
    }

    return { ok: true };
  },

  resolve(): [] {
    return [];
  },

  execute(
    state: GameState,
    _action,
    _intents: [],
    executionBuilder: ExecutionBuilder,
    parentNode: ExecutionNode,
  ): void {
    const from = state.floor;
    const result = performFloorTransition(state, 'up');
    executionBuilder.addChild(parentNode, {
      type: 'FLOOR_CHANGED',
      from,
      to: result.to,
    });
    for (const fovEvent of result.fovEvents) {
      executionBuilder.addChild(parentNode, fovEvent);
    }
  },
};

// ─────────────────────────────────────────────
// Переход этажа
// ─────────────────────────────────────────────

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
  const targetStairsDir: 'up' | 'down' = direction === 'down' ? 'up' : 'down';
  const stairs = findStairsInState(state, targetStairsDir);
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

// ─────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────

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

  // Лестницы
  if (generated.stairsDown && targetFloor < MAX_FLOOR) {
    state.entities.set(`stairs_down_${targetFloor}`, createStairs(state, 'down', generated.stairsDown.x, generated.stairsDown.y));
  }
  if (generated.stairsUp && targetFloor > 1) {
    state.entities.set(`stairs_up_${targetFloor}`, createStairs(state, 'up', generated.stairsUp.x, generated.stairsUp.y));
  }

  // explored начинается чистой
  state.explored = createBoolGrid(state.map.width, state.map.height, false);
}

function findStairsInState(state: GameState, direction: 'down' | 'up'): StairsEntity | undefined {
  return Array.from(state.entities.values()).find(
    (e): e is StairsEntity => e.type === 'stairs' && e.direction === direction,
  );
}
