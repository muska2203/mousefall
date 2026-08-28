/**
 * Хелперы для получения тегов и распределения урона базовой атаки сущности.
 * Враг читается из профиля `attack`, игрок — из экипированного оружия.
 */

import type {Entity} from '@simulation/types.ts';
import {tryGetItem} from '@content/registry';
import type {GameplayTag} from '@simulation/core-types.ts';

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
 * Возвращает теги атаки сущности.
 * Враг — теги из профиля `attack` (прямые статы вместо экипировки).
 * Игрок без экипированного оружия — теги из шаблона unarmed; константа
 * UNARMED_TAGS — fallback, если реестр недоступен или unarmed отсутствует.
 * Для не-акторов возвращает пустой массив.
 */
export function getWeaponTags(entity: Entity): GameplayTag[] {
  if (entity.type === 'enemy') {
    return entity.attack.tags.slice();
  }
  if (entity.type !== 'player') {
    return [];
  }

  if (entity.equippedWeaponId === null) {
    return tryGetItem('unarmed')?.weapon?.tags ?? UNARMED_TAGS.slice();
  }

  return tryGetItem(entity.equippedWeaponId)?.weapon?.tags ?? [];
}

/**
 * Возвращает распределение типов урона базовой атаки сущности.
 * Враг — из профиля `attack`; игрок — из экипированного оружия,
 * при его отсутствии — из шаблона unarmed.
 * Константа UNARMED_DAMAGE_DISTRIBUTION — fallback, если реестр
 * недоступен или unarmed отсутствует.
 */
export function getWeaponDamageDistribution(entity: Entity): Array<{ damageTag: GameplayTag; weight: number }> {
  if (entity.type === 'enemy') {
    return entity.attack.damageDistribution.map(entry => ({ ...entry }));
  }
  if (entity.type !== 'player') {
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
