/**
 * Хелперы для получения тегов экипированного оружия сущности.
 */

import type { Entity } from '@simulation/types.ts';
import { tryGetItem } from '@content/registry';
import type { GameplayTag } from '@simulation/core-types.ts';
import { isStatActor } from '@simulation/systems/stats/effective-stats';

/** Теги рукопашной безоружной атаки по умолчанию. */
const UNARMED_TAGS: GameplayTag[] = [
  'attack.melee',
  'target.single',
  'delivery.weapon',
  'delivery.unarmed',
  'damage.physical.blunt',
];

/**
 * Возвращает теги оружия, экипированного сущностью.
 * Если сущность — StatActor без экипированного оружия, возвращает теги безоружной атаки.
 * Для не-StatActor возвращает пустой массив.
 */
export function getWeaponTags(entity: Entity): GameplayTag[] {
  if (!isStatActor(entity)) {
    return [];
  }

  if (entity.equippedWeaponId === null) {
    return UNARMED_TAGS.slice();
  }

  return tryGetItem(entity.equippedWeaponId)?.weapon?.tags ?? [];
}
