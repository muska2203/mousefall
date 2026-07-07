/**
 * Чистые хелперы для работы с игровыми тегами.
 *
 * Теги используются для классификации интентов, событий, оружия и способностей
 * без привязки к конкретным enum'ам (например, attack.melee, target.aoe).
 */

import type { GameplayTag } from '@simulation/core-types.ts';

export type { GameplayTag };

/**
 * Проверяет, содержит ли массив тегов указанный тег.
 */
export function hasTag(tags: readonly GameplayTag[], tag: GameplayTag): boolean {
  return tags.includes(tag);
}

/**
 * Проверяет, содержит ли массив тегов ВСЕ теги из списка required.
 * Если required пустой — возвращает true.
 */
export function hasAllTags(tags: readonly GameplayTag[], required: readonly GameplayTag[]): boolean {
  return required.every((tag) => tags.includes(tag));
}

/**
 * Проверяет, содержит ли массив тегов ХОТЯ БЫ ОДИН тег из списка candidates.
 * Если candidates пустой — возвращает false.
 */
export function hasAnyTag(tags: readonly GameplayTag[], candidates: readonly GameplayTag[]): boolean {
  return candidates.some((tag) => tags.includes(tag));
}
