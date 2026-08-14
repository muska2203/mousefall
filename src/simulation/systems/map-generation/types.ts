/**
 * Типы паттерна Strategy для генерации карт.
 *
 * Позволяет подменять алгоритм генерации этажа без изменения потребителей
 * (GameSimulation, floor-transition-logic и т.д.).
 */

import type {DoorEntity, EnemyEntity, FloorItemContainerEntity, GameMap, GameState, PointOfInterestEntity, PropEntity, TrapEntity} from '@simulation/types';
import type {TileEffects} from '@simulation/core-types';
import type {MapParams} from '@content/schemas';
import type {MapStrategyId} from '@content/ids';

/**
 * Результат генерации одного этажа.
 * Все стратегии возвращают одинаковую структуру, которую вызывающий
 * применяет к GameState.
 */
export type GeneratedMap = {
  map: GameMap;
  playerStart: { x: number; y: number };
  stairsDown: { x: number; y: number } | null;
  stairsUp: { x: number; y: number } | null;
  enemies: EnemyEntity[];
  items: FloorItemContainerEntity[];
  doors: DoorEntity[];
  pois: PointOfInterestEntity[];
  props: PropEntity[];
  traps: TrapEntity[];
  /** Начальные тайловые эффекты этажа (лужи из наполнения комнат). */
  tileEffects: TileEffects[][];
};

/**
 * Интерфейс стратегии генерации карты.
 *
 * Контракт:
 * - НЕ мутирует GameState напрямую, кроме state.nextEntityCounter для генерации ID.
 * - Вся случайность через state.rng.
 * - Возвращает полный GeneratedMap.
 */
export interface MapGenerationStrategy {
  /** Уникальный ID стратегии из каталога MAP_STRATEGY_IDS, совпадающий со значением MapParams.strategy. */
  readonly id: MapStrategyId;

  generate(
    params: MapParams,
    state: GameState,
    currentFloor: number,
    maxFloor: number,
  ): GeneratedMap;
}
