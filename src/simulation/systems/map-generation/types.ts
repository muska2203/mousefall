/**
 * Типы паттерна Strategy для генерации карт.
 *
 * Позволяет подменять алгоритм генерации этажа без изменения потребителей
 * (GameSimulation, floor-transition-logic и т.д.).
 */

import type { GameMap, EnemyEntity, ItemEntity, DoorEntity, GameState } from '@simulation/types';
import type { MapParams } from '@content/schemas';

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
  items: ItemEntity[];
  doors: DoorEntity[];
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
  /** Уникальный ID стратегии, совпадающий со значением MapParams.strategy. */
  readonly id: string;

  generate(
    params: MapParams,
    state: GameState,
    currentFloor: number,
    maxFloor: number,
  ): GeneratedMap;
}
