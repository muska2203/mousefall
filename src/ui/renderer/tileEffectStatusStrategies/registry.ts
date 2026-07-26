/**
 * Реестр стратегий отрисовки статусов тайловых эффектов.
 *
 * Позволяет добавлять кастомную визуализацию для новых статусов
 * без изменения TileEffectStatusRenderer.
 */

import type {TileEffectStatusStrategy} from './types';

const strategies = new Map<string, TileEffectStatusStrategy>();

/** Зарегистрировать стратегию для статуса. */
export function registerTileEffectStatusStrategy(strategy: TileEffectStatusStrategy): void {
  strategies.set(strategy.statusType, strategy);
}

/** Получить стратегию по типу статуса. */
export function getTileEffectStatusStrategy(statusType: string): TileEffectStatusStrategy | undefined {
  return strategies.get(statusType);
}

/** Все зарегистрированные стратегии. */
export function getAllTileEffectStatusStrategies(): Iterable<TileEffectStatusStrategy> {
  return strategies.values();
}
