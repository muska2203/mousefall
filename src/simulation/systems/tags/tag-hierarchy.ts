/**
 * Иерархические операции над игровыми тегами.
 *
 * Теги вида `a.b.c` образуют дерево: каждый префикс (`a.b`, `a`) считается
 * родительским тегом. Развёртка используется для проверки наследования
 * категорий (например, `attack.melee` удовлетворяет запросу `attack`).
 */

import type {GameplayTag} from '@simulation/core-types.ts';

export type { GameplayTag };

/**
 * Разворачивает иерархический тег в массив от конкретного к общему.
 *
 * @example
 * expandTag('a.b.c') // ['a.b.c', 'a.b', 'a']
 *
 * @param tag — исходный тег
 * @returns массив тегов-префиксов; пустой тег даёт пустой массив
 */
export function expandTag(tag: GameplayTag): GameplayTag[] {
  if (!tag) {
    return [];
  }

  const parts = tag.split('.');
  const result: GameplayTag[] = [];

  for (let i = parts.length; i > 0; i--) {
    result.push(parts.slice(0, i).join('.'));
  }

  return result;
}

/**
 * Разворачивает массив тегов с удалением дубликатов.
 *
 * Порядок результатов группирует теги по глубине: сначала все самые
 * конкретные теги (в порядке исходного массива), затем их непосредственные
 * родители и так далее до корня. Внутри одного уровня сохраняется порядок
 * первого появления.
 *
 * @param tags — исходные теги
 * @returns уникальный набор развёрнутых тегов
 */
export function expandTags(tags: readonly GameplayTag[]): GameplayTag[] {
  const expanded = tags.map(expandTag);
  const maxDepth = Math.max(0, ...expanded.map((group) => group.length));
  const result: GameplayTag[] = [];
  const seen = new Set<GameplayTag>();

  for (let depth = 0; depth < maxDepth; depth++) {
    for (const group of expanded) {
      if (depth < group.length) {
        const tag = group[depth]!;
        if (!seen.has(tag)) {
          seen.add(tag);
          result.push(tag);
        }
      }
    }
  }

  return result;
}
