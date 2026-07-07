/**
 * Хелперы для получения тегов экипированного оружия сущности.
 */

import type { Entity, StatActor } from '@simulation/types.ts';
import { tryGetItem } from '@content/registry';
import type { GameplayTag } from '@simulation/core-types.ts';

/** Теги рукопашной безоружной атаки по умолчанию. */
const UNARMED_TAGS: GameplayTag[] = [
  'attack.melee',
  'target.single',
  'delivery.weapon',
  'delivery.unarmed',
];

/**
 * Type guard: проверяет, что сущность имеет derived-статы и экипировку.
 * В проекте аналогичная функция существует в effective-stats.ts, но не экспортирована,
 * поэтому здесь используется локальная копия для изоляции модуля тегов.
 */
function isStatActor(entity: Entity): entity is Entity & StatActor {
  return 'baseStats' in entity;
}

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
