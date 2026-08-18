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
import type {ContentTexts} from './texts/types';

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
    checkRefs(errors, path, 'roomTypePool', map.roomTypePool, 'roomTypes', content.roomTypes);
    checkRef(errors, path, 'startRoomTypeId', map.startRoomTypeId, 'roomTypes', content.roomTypes);
    checkRefs(errors, path, 'relicPool', map.relicPool ?? [], 'relics', content.relics);
    // Босс-инфраструктура проверяется только при заданном bossPool.
    if (map.bossPool) {
      checkRefs(errors, path, 'bossPool', map.bossPool, 'entities', content.entities);
      // Каждый шаблон пула обязан быть помечен как босс (isBoss: true).
      for (const bossId of map.bossPool) {
        const template = content.entities.get(bossId);
        if (template && !template.isBoss) {
          errors.push({
            path,
            field: 'bossPool',
            problem: `Шаблон "${bossId}" в bossPool не помечен как босс (isBoss: true)`,
          });
        }
      }
      checkRef(errors, path, 'bossRoomTypeId', map.bossRoomTypeId, 'roomTypes', content.roomTypes);
      checkRef(errors, path, 'rewardRoomTypeId', map.rewardRoomTypeId, 'roomTypes', content.roomTypes);
      checkRef(errors, path, 'bossDoorId', map.bossDoorId, 'doors', content.doors);
    }
  }

  for (const [id, roomType] of content.roomTypes ?? []) {
    const path = `roomTypes.${id}`;
    if (roomType.kind !== 'generated') continue;
    const fill = roomType.fill;
    checkRefs(errors, path, 'fill.enemyPool', fill.enemyPool, 'entities', content.entities);
    checkRefs(errors, path, 'fill.itemPool', fill.itemPool, 'items', content.items);
    checkRefs(errors, path, 'fill.propPool', fill.propPool, 'props', content.props);
    checkRefs(errors, path, 'fill.trapPool', fill.trapPool, 'traps', content.traps);
    checkRefs(errors, path, 'fill.tileEffectPool', fill.tileEffectPool, 'tileEffects', content.tileEffects);
    checkRefs(errors, path, 'fill.guaranteedPois', fill.guaranteedPois, 'pois', content.pois);
  }

  for (const [id, status] of content.statuses) {
    const path = `statuses.${id}`;
    checkRefs(errors, path, 'mutuallyExclusiveWith', status.mutuallyExclusiveWith, 'statuses', content.statuses);
    checkRefs(errors, path, 'blockedBy', status.blockedBy, 'statuses', content.statuses);
  }

  for (const [id, ability] of content.abilities) {
    // Self-buff способность обязана ссылаться на существующий шаблон статуса (fail fast).
    if (ability.kind === 'selfBuff') {
      checkRef(errors, `abilities.${id}`, 'statusType', ability.statusType, 'statuses', content.statuses);
    }
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
    // Фирменные модификаторы: ссылка существует и применима к подтипу предмета.
    for (const modifierId of item.fixedModifiers) {
      checkRef(errors, path, 'fixedModifiers', modifierId, 'modifiers', content.modifiers);
      const modifier = content.modifiers?.get(modifierId);
      if (modifier && item.subtype && !modifier.applicableSubtypes.includes(item.subtype)) {
        errors.push({
          path,
          field: 'fixedModifiers',
          problem: `Модификатор "${modifierId}" не применим к подтипу "${item.subtype}" (applicableSubtypes: ${modifier.applicableSubtypes.join(', ')})`,
        });
      }
      if (modifier && modifier.scaling.kind === 'perLevel') {
        errors.push({
          path,
          field: 'fixedModifiers',
          problem: `Фирменный модификатор "${modifierId}" не может иметь scaling perLevel: фирменные свойства детерминированы (fixed/none)`,
        });
      }
    }
  }

  for (const [id, relic] of content.relics ?? []) {
    checkRefs(errors, `relics.${id}`, 'grantedAbilities', relic.grantedAbilities, 'abilities', content.abilities);
  }

  return errors;
}

/**
 * Проверяет плейсхолдер {value} в описаниях модификаторов (аффиксов).
 * {value} подставляет значение экземпляра (ролленное или фиксированное), поэтому допустим
 * только у аффиксов со scaling perLevel/fixed — иначе в UI отрисуется заглушка «—».
 * Тексты передаются параметром, чтобы функция оставалась чистой и тестируемой.
 */
export function validateModifierTextPlaceholders(
  content: LoadedContent,
  textsByLocale: Record<string, ContentTexts>,
): ContentReferenceError[] {
  const errors: ContentReferenceError[] = [];

  for (const [id, modifier] of content.modifiers ?? []) {
    if (modifier.scaling.kind !== 'none') continue;

    for (const [locale, texts] of Object.entries(textsByLocale)) {
      const description = texts.modifiers[id]?.description;
      if (description?.includes('{value}')) {
        errors.push({
          path: `modifiers.${id}`,
          field: 'description',
          problem: `Плейсхолдер {value} в описании (${locale}) требует scaling perLevel/fixed: без значения в UI отрисуется «—»`,
        });
      }
    }
  }

  return errors;
}
