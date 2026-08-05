/**
 * Валидация перекрёстных ссылок между шаблонами контента.
 *
 * Проверяет, что id, на которые шаблоны ссылаются друг на друга
 * (снаряжение, способности, таблицы лута, пулы карт, статусы и т.д.),
 * указывают на существующие шаблоны. Без этой проверки несуществующий id
 * всплывал бы только в рантайме (например, при дропе лута).
 *
 * Чистая функция: не бросает исключений, а собирает все ошибки —
 * по образцу validateContentRuleSemantics.
 */

import type {LoadedContent} from './schemas';

/** Ошибка ссылки между шаблонами контента. */
export type ContentReferenceError = {
  /** Путь к шаблону-источнику (например, entities.cat_small.equipment). */
  path: string;
  /** Поле с битой ссылкой. */
  field: string;
  /** Описание проблемы. */
  problem: string;
};

function checkRef(
  errors: ContentReferenceError[],
  path: string,
  field: string,
  id: string,
  targetCategory: string,
  target: Map<string, unknown> | undefined,
): void {
  if (!target?.has(id)) {
    errors.push({
      path,
      field,
      problem: `Ссылка на несуществующий шаблон "${id}" в категории ${targetCategory}`,
    });
  }
}

function checkRefs(
  errors: ContentReferenceError[],
  path: string,
  field: string,
  ids: readonly string[],
  targetCategory: string,
  target: Map<string, unknown> | undefined,
): void {
  for (const id of ids) {
    checkRef(errors, path, field, id, targetCategory, target);
  }
}

/**
 * Проверяет все перекрёстные ссылки между шаблонами и возвращает список ошибок.
 * Пустой массив — все ссылки в порядке.
 */
export function validateContentReferences(content: LoadedContent): ContentReferenceError[] {
  const errors: ContentReferenceError[] = [];

  for (const [id, entity] of content.entities) {
    const path = `entities.${id}`;
    if (entity.equipment.weapon) {
      checkRef(errors, path, 'equipment.weapon', entity.equipment.weapon, 'items', content.items);
    }
    if (entity.equipment.armor) {
      checkRef(errors, path, 'equipment.armor', entity.equipment.armor, 'items', content.items);
    }
    if (entity.equipment.amulet) {
      checkRef(errors, path, 'equipment.amulet', entity.equipment.amulet, 'items', content.items);
    }
    checkRefs(errors, path, 'abilities', entity.abilities, 'abilities', content.abilities);
    for (const entry of entity.lootTable) {
      checkRef(errors, path, 'lootTable[].templateId', entry.templateId, 'items', content.items);
    }
  }

  for (const [id, player] of content.players) {
    checkRefs(errors, `players.${id}`, 'starterEquipment', player.starterEquipment ?? [], 'items', content.items);
  }

  for (const [id, map] of content.maps) {
    const path = `maps.${id}`;
    checkRefs(errors, path, 'enemyPool', map.enemyPool, 'entities', content.entities);
    checkRefs(errors, path, 'itemPool', map.itemPool, 'items', content.items);
    if (map.startPoiId) {
      checkRef(errors, path, 'startPoiId', map.startPoiId, 'pois', content.pois);
    }
    checkRefs(errors, path, 'relicPool', map.relicPool ?? [], 'relics', content.relics);
  }

  for (const [id, status] of content.statuses) {
    const path = `statuses.${id}`;
    checkRefs(errors, path, 'mutuallyExclusiveWith', status.mutuallyExclusiveWith, 'statuses', content.statuses);
    checkRefs(errors, path, 'blockedBy', status.blockedBy, 'statuses', content.statuses);
  }

  for (const [id, effect] of content.tileEffects) {
    const path = `tileEffects.${id}`;
    checkRefs(errors, path, 'canHaveStatus', effect.canHaveStatus, 'tileEffectStatuses', content.tileEffectStatuses);
    checkRefs(errors, path, 'durationDecreasesWhenHasStatus', effect.durationDecreasesWhenHasStatus, 'tileEffectStatuses', content.tileEffectStatuses);
  }

  for (const [id, door] of content.doors) {
    checkRefs(errors, `doors.${id}`, 'canHaveStatus', door.canHaveStatus, 'statuses', content.statuses);
  }

  for (const [id, prop] of content.props ?? []) {
    checkRefs(errors, `props.${id}`, 'canHaveStatus', prop.canHaveStatus, 'statuses', content.statuses);
  }

  for (const [id, item] of content.items) {
    const path = `items.${id}`;
    if (item.consumable?.tileEffectType) {
      checkRef(errors, path, 'consumable.tileEffectType', item.consumable.tileEffectType, 'tileEffects', content.tileEffects);
    }
    checkRefs(errors, path, 'grantedAbilities', item.grantedAbilities, 'abilities', content.abilities);
    for (const entry of item.abilityPool) {
      checkRef(errors, path, 'abilityPool[].abilityId', entry.abilityId, 'abilities', content.abilities);
    }
  }

  for (const [id, relic] of content.relics ?? []) {
    checkRefs(errors, `relics.${id}`, 'grantedAbilities', relic.grantedAbilities, 'abilities', content.abilities);
  }

  return errors;
}
