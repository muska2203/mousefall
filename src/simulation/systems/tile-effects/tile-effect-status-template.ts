/**
 * Доступ к шаблонам статусов тайловых эффектов из слоя симуляции.
 *
 * Правила:
 * - Симуляция читает шаблоны только через tryGetTileEffectStatus из content/registry.
 * - Не кэшируем шаблоны внутри симуляции: реестр уже неизменен после загрузки.
 */

import type {TileEffectStatusTemplate} from '@content/schemas';
import {tryGetTileEffectStatus} from '@content/registry';

/**
 * Возвращает шаблон статуса тайлового эффекта по его ID.
 * Если реестр не инициализирован или шаблон не найден — возвращает null.
 */
export function getTileEffectStatusTemplate(statusType: string): TileEffectStatusTemplate | null {
  return tryGetTileEffectStatus(statusType) ?? null;
}
