/**
 * Хелперы для получения тегов способности по ID шаблона.
 */

import {tryGetAbility} from '@content/registry';
import type {GameplayTag} from '@simulation/core-types.ts';
import type {AbilityTemplate} from '@content/schemas';

/**
 * Возвращает теги классификации способности из реестра контента.
 * Включает как обычные теги (tags), так и тег урона (damageTag), если он задан.
 * Если способность не найдена — возвращает пустой массив.
 */
export function getAbilityTags(abilityId: string): GameplayTag[] {
  const ability = tryGetAbility(abilityId);
  if (!ability) return [];
  const tags = ability.tags ?? [];
  return ability.damageTag ? [...tags, ability.damageTag] : tags;
}

/**
 * Возвращает тег урона способности (damageTag) из JSON-шаблона.
 * Если способность не найдена или damageTag не задан — возвращает undefined.
 */
export function getSkillDamageTag(ability: AbilityTemplate | undefined): GameplayTag | undefined {
  return ability?.damageTag;
}
