/**
 * Хелперы для получения тегов способности по ID шаблона.
 */

import { tryGetAbility } from '@content/registry';
import type { GameplayTag } from '@simulation/core-types.ts';

/**
 * Возвращает теги классификации способности из реестра контента.
 * Если способность не найдена — возвращает пустой массив.
 */
export function getAbilityTags(abilityId: string): GameplayTag[] {
  return tryGetAbility(abilityId)?.tags ?? [];
}
