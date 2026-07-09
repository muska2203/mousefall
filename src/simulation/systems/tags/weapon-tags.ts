/**
 * Хелперы для получения тегов экипированного оружия сущности.
 */

import type { Entity } from '@simulation/types.ts';
import { tryGetItem } from '@content/registry';
import type { GameplayTag } from '@simulation/core-types.ts';
import { isStatActor } from '@simulation/systems/stats/effective-stats';

/** Распределение урона безоружной атаки по умолчанию. */
export const UNARMED_DAMAGE_DISTRIBUTION: Array<{ damageTag: GameplayTag; weight: number }> = [
  { damageTag: 'damage.physical.blunt', weight: 1.0 },
];

/** Теги рукопашной безоружной атаки по умолчанию (без тегов урона). */
const UNARMED_TAGS: GameplayTag[] = [
  'attack.melee',
  'target.single',
  'delivery.weapon',
  'delivery.unarmed',
];

/**
 * Возвращает теги оружия, экипированного сущностью.
 * Если сущность — StatActor без экипированного оружия, загружает unarmed.json
 * из реестра. Константы UNARMED_TAGS используются как fallback, если реестр
 * недоступен или unarmed.json отсутствует.
 * Для не-StatActor возвращает пустой массив.
 */
export function getWeaponTags(entity: Entity): GameplayTag[] {
  if (!isStatActor(entity)) {
    return [];
  }

  if (entity.equippedWeaponId === null) {
    return tryGetItem('unarmed')?.weapon?.tags ?? UNARMED_TAGS.slice();
  }

  return tryGetItem(entity.equippedWeaponId)?.weapon?.tags ?? [];
}

/**
 * Возвращает распределение типов урона экипированного оружия сущности.
 * Для не-StatActor или при отсутствии оружия загружает распределение из unarmed.json.
 * Константы UNARMED_DAMAGE_DISTRIBUTION используются как fallback, если реестр
 * недоступен или unarmed.json отсутствует.
 */
export function getWeaponDamageDistribution(entity: Entity): Array<{ damageTag: GameplayTag; weight: number }> {
  if (!isStatActor(entity)) {
    return UNARMED_DAMAGE_DISTRIBUTION.slice();
  }

  if (entity.equippedWeaponId === null) {
    const unarmedTemplate = tryGetItem('unarmed');
    if (unarmedTemplate?.weapon?.damageDistribution && unarmedTemplate.weapon.damageDistribution.length > 0) {
      return unarmedTemplate.weapon.damageDistribution.map(entry => ({ ...entry }));
    }
    return UNARMED_DAMAGE_DISTRIBUTION.slice();
  }

  const template = tryGetItem(entity.equippedWeaponId);
  if (template?.weapon?.damageDistribution && template.weapon.damageDistribution.length > 0) {
    return template.weapon.damageDistribution.map(entry => ({ ...entry }));
  }

  return UNARMED_DAMAGE_DISTRIBUTION.slice();
}

/**
 * Возвращает основной тег урона оружия — запись с максимальным весом.
 */
export function getPrimaryDamageTag(entity: Entity): GameplayTag {
  const distribution = getWeaponDamageDistribution(entity);
  let primary = UNARMED_DAMAGE_DISTRIBUTION[0]!.damageTag;
  let maxWeight = -Infinity;
  for (const entry of distribution) {
    if (entry.weight > maxWeight) {
      maxWeight = entry.weight;
      primary = entry.damageTag;
    }
  }
  return primary;
}

/**
 * Возвращает вес указанного тега урона для экипированного оружия.
 * Если тег отсутствует — возвращает 0.
 */
export function getWeaponWeightForTag(entity: Entity, tag: GameplayTag): number {
  const distribution = getWeaponDamageDistribution(entity);
  return distribution.find(entry => entry.damageTag === tag)?.weight ?? 0;
}
