/**
 * Реестр стратегий генерации карт.
 *
 * В проекте оставлена единственная стратегия — дерево комнат (tree).
 * Реестр сохранён, чтобы точка выбора алгоритма оставалась в одном месте
 * и при необходимости новые стратегии можно было добавлять без изменения
 * потребителей.
 */

import type { MapGenerationStrategy } from './types';
import { treeRoomStrategy } from './tree-room-strategy';

const strategies = new Map<string, MapGenerationStrategy>([
  [treeRoomStrategy.id, treeRoomStrategy],
]);

/**
 * Возвращает стратегию генерации по ID.
 *
 * @param id - ID стратегии (значение MapParams.strategy).
 * @returns Стратегия или стратегия по умолчанию (tree), если ID неизвестен.
 */
export function getMapGenerationStrategy(id: string | undefined): MapGenerationStrategy {
  const strategy = strategies.get(id ?? 'tree');
  if (strategy) return strategy;

  console.warn(`[mapgen] Unknown strategy "${id}", falling back to tree room strategy.`);
  return treeRoomStrategy;
}

/**
 * Регистрирует новую стратегию генерации.
 *
 * Может использоваться при старте приложения для подключения
 * модульных алгоритмов без изменения этого файла.
 */
export function registerMapGenerationStrategy(strategy: MapGenerationStrategy): void {
  strategies.set(strategy.id, strategy);
}
