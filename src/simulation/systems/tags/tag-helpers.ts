/**
 * Чистые хелперы для работы с игровыми тегами.
 *
 * Теги используются для классификации интентов, событий, оружия и способностей
 * без привязки к конкретным enum'ам (например, attack.melee, target.aoe).
 */

import type { GameplayTag } from '@simulation/core-types.ts';

export type { GameplayTag };

export { expandTag, expandTags } from './tag-hierarchy.ts';

/**
 * Проверяет, содержит ли массив тегов указанный тег или любой его потомок.
 *
 * Пример: hasTag(['damage.physical.blunt'], 'damage.physical') === true.
 */
export function hasTag(tags: readonly GameplayTag[], tag: GameplayTag): boolean {
  return tags.some((t) => t === tag || t.startsWith(`${tag}.`));
}

/**
 * Проверяет, содержит ли массив тегов ВСЕ теги из списка required.
 * Если required пустой — возвращает true.
 */
export function hasAllTags(tags: readonly GameplayTag[], required: readonly GameplayTag[]): boolean {
  return required.every((tag) => hasTag(tags, tag));
}

/**
 * Проверяет, содержит ли массив тегов ХОТЯ БЫ ОДИН тег из списка candidates.
 * Если candidates пустой — возвращает false.
 */
export function hasAnyTag(tags: readonly GameplayTag[], candidates: readonly GameplayTag[]): boolean {
  return candidates.some((tag) => hasTag(tags, tag));
}

/**
 * Объединяет теги, гарантируя ровно один damage.*-тег.
 * Используется для формирования DAMAGE-интентов.
 *
 * Сохраняет порядок и удаляет дубликаты non-damage тегов.
 * Приоритет у первого встреченного damage-тега; все последующие игнорируются.
 */
export function mergeDamageIntentTags(...arrays: readonly GameplayTag[][]): GameplayTag[] {
  const result: GameplayTag[] = [];
  const seen = new Set<GameplayTag>();
  let damageTagSet = false;

  for (const arr of arrays) {
    for (const tag of arr) {
      const isDamageTag = tag === 'damage' || tag.startsWith('damage.');
      if (isDamageTag) {
        if (damageTagSet) {
          continue;
        }
        damageTagSet = true;
      }
      if (!seen.has(tag)) {
        seen.add(tag);
        result.push(tag);
      }
    }
  }
  return result;
}
