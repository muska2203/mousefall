/**
 * Планировщик перехода между этажами.
 *
 * Ответственность:
 * - Сохранить текущий этаж в `state.floorSnapshots`.
 * - Определить целевой этаж (восстановить из снапшота или сгенерировать новый).
 * - Найти позицию игрока после перехода.
 * - Подготовить данные для атомарных интентов, которые выполнят фактический переход.
 *
 * Контракт:
 * - Не заменяет `state.map` / `state.entities` напрямую.
 * - Мутирует только сервисное состояние: `state.rng`, `state.nextEntityCounter`
 *   (через генерацию карты) и `state.floorSnapshots`.
 */

import type { GameState, StairsEntity, GameEvent, GameMap, Entity, EntityId, Position, TurnSide } from '@simulation/types';
import { createBoolGrid } from '@simulation/state';
import { generateMap, createStairs } from '@simulation/systems/mapgen';
import { updateFOV } from '@simulation/systems/fov';
import { MAX_FLOOR } from '@utils/constants';

export type FloorTransitionPlan = {
  /** Направление перехода. */
  direction: 'down' | 'up';
  /** Этаж, с которого уходим. */
  from: number;
  /** Этаж, на который приходим. */
  to: number;
  /** Карта целевого этажа. */
  map: GameMap;
  /** Сущности целевого этажа (включая игрока). */
  entities: Map<EntityId, Entity>;
  /** Позиция игрока после перехода. */
  playerPosition: Position;
  /** Состояние хода после перехода. */
  turn: { activeSide: TurnSide; round: number };
  /** Сетка исследованных клеток целевого этажа. */
  explored: boolean[][];
  /** События FOV, полученные после пересчёта на целевом состоянии. */
  fovEvents: GameEvent[];
};

/**
 * Вычисляет план перехода на другой этаж.
 *
 * Не применяет план к `state` напрямую — мутации выполняют IntentExecutor-ы.
 */
export function computeFloorTransition(
  state: GameState,
  direction: 'down' | 'up',
): FloorTransitionPlan {
  // 1. Сохраняем текущий этаж (без игрока).
  const currentFloorEntities = Array.from(state.entities.values()).filter(e => e.id !== 'player');
  state.floorSnapshots[state.floor - 1] = {
    floor: state.floor,
    map: state.map,
    entities: currentFloorEntities,
    explored: state.explored,
    rngState: state.rng.state,
  };

  const from = state.floor;
  const to = direction === 'down' ? state.floor + 1 : state.floor - 1;

  // 2. Восстановление из снапшота или генерация нового этажа.
  let targetMap: GameMap;
  let targetEntities: Entity[];
  let targetExplored: boolean[][];

  const savedSnapshot = state.floorSnapshots[to - 1];
  if (savedSnapshot) {
    targetMap = savedSnapshot.map;
    targetEntities = savedSnapshot.entities.slice();
    targetExplored = savedSnapshot.explored;
  } else {
    const generated = generateMap(state.mapParams, state, to, MAX_FLOOR);

    targetMap = generated.map;
    targetEntities = [
      ...generated.enemies,
      ...generated.items,
      ...generated.doors,
    ];

    if (generated.stairsDown && to < MAX_FLOOR) {
      targetEntities.push(createStairs(state, 'stairs_down', generated.stairsDown.x, generated.stairsDown.y));
    }
    if (generated.stairsUp && to > 1) {
      targetEntities.push(createStairs(state, 'stairs_up', generated.stairsUp.x, generated.stairsUp.y));
    }

    targetExplored = createBoolGrid(targetMap.width, targetMap.height, false);
  }

  // 3. Целевая коллекция сущностей всегда содержит игрока.
  const entities = new Map<EntityId, Entity>();
  for (const entity of targetEntities) {
    entities.set(entity.id, entity);
  }
  entities.set(state.player.id, state.player);

  // 4. Позиционирование игрока у противоположной лестницы.
  const targetStairsTemplateId = direction === 'down' ? 'stairs_up' : 'stairs_down';
  const stairs = findStairsInEntities(entities, targetStairsTemplateId);

  let playerPosition: Position;
  if (stairs) {
    playerPosition = { x: stairs.x, y: stairs.y };
  } else {
    const firstRoom = targetMap.rooms[0];
    if (firstRoom) {
      playerPosition = {
        x: Math.floor(firstRoom.x + firstRoom.width / 2),
        y: Math.floor(firstRoom.y + firstRoom.height / 2),
      };
    } else {
      playerPosition = { x: state.player.x, y: state.player.y };
    }
  }

  // 5. Пересчёт FOV на временном состоянии с целевой картой и позицией игрока.
  const tempPlayer = { ...state.player, x: playerPosition.x, y: playerPosition.y };
  const tempEntities = new Map(entities);
  tempEntities.set(tempPlayer.id, tempPlayer);

  const tempState: GameState = {
    ...state,
    map: targetMap,
    entities: tempEntities,
    player: tempPlayer,
    visible: createBoolGrid(targetMap.width, targetMap.height, false),
    explored: targetExplored,
  };
  const fovEvents = updateFOV(tempState);

  const turn: { activeSide: TurnSide; round: number } = { activeSide: 'PLAYER', round: 1 };

  return {
    direction,
    from,
    to,
    map: targetMap,
    entities,
    playerPosition,
    turn,
    explored: targetExplored,
    fovEvents,
  };
}

function findStairsInEntities(
  entities: Map<EntityId, Entity>,
  templateId: string,
): StairsEntity | undefined {
  return Array.from(entities.values()).find(
    (e): e is StairsEntity => e.type === 'stairs' && e.templateId === templateId,
  );
}
