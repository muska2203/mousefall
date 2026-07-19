/**
 * Точка входа в систему процедурной генерации карт.
 *
 * Использует паттерн Strategy: конкретный алгоритм выбирается по полю
 * `strategy` из MapParams. В проекте оставлена единственная стратегия:
 * - "tree" — дерево комнат от спавна до выхода.
 *
 * Добавление нового алгоритма:
 * 1. Реализовать MapGenerationStrategy в `map-generation/<name>-strategy.ts`.
 * 2. Зарегистрировать через `registerMapGenerationStrategy` или добавить
 *    в `map-generation/strategy-registry.ts`.
 *
 * Контракт: generateMap(params, state, currentFloor, maxFloor) → GeneratedMap
 * - НЕ мутирует GameState напрямую (кроме state.nextEntityCounter для ID).
 * - Вся случайность через state.rng (детерминированно).
 */

import type {GameState} from '@simulation/types';
import type {MapParams} from '@content/schemas';
import type {GeneratedMap} from './map-generation/types';
import {getMapGenerationStrategy} from './map-generation/strategy-registry';

export type { GeneratedMap } from './map-generation/types';

// Реэкспорт фабрик сущностей для обратной совместимости
export {
  createEnemy,
  createFloorItem,
  createStairs,
  createDoor,
} from './map-generation/shared';

/**
 * Генерирует полный этаж подземелья выбранной стратегией.
 */
export function generateMap(
  params: MapParams,
  state: GameState,
  currentFloor: number,
  maxFloor: number,
): GeneratedMap {
  const strategy = getMapGenerationStrategy(params.strategy);
  return strategy.generate(params, state, currentFloor, maxFloor);
}
