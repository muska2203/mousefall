/**
 * Разрешение спрайтов объектов окружения по их визуальному стейту.
 *
 * Визуальный стейт — производная строка, вычисляемая Presentation из полей
 * сущности Simulation на каждом перестроении RenderInput. Нигде не хранится:
 * стоит Simulation изменить исходное поле (charges, isOpen, ...) — стейт
 * пересчитается при ближайшем рендере.
 *
 * Известные стейты:
 * - 'default' — базовый спрайт '<id>.png' (есть у всех типов);
 * - door: 'open' — дверь открыта;
 * - poi: 'depleted' — заряды исчерпаны (charges === 0).
 *
 * Приоритет выбора spriteId: spriteVariants[state] из шаблона → legacy-поля
 * (openSpriteId двери) → конвенция '<id>_<state>.png'.
 *
 * Расширение: новый стейт — это одна запись в STATE_RESOLVERS + ассет по
 * конвенции (или spriteVariants в шаблоне). UI и схемы не меняются.
 */

import type {Entity, GameState} from '@simulation/types';
import {tryGetDoor, tryGetPoi, tryGetProp, tryGetStairs, tryGetTrap} from '@content/registry';
import {resolveObjectSprite, type ObjectSpriteCategory} from '@utils/assetResolver';

/** Категория ассетов по типу сущности. Типы без категории спрайтов-стейтов не имеют. */
const CATEGORY_BY_TYPE: Partial<Record<Entity['type'], ObjectSpriteCategory>> = {
  door: 'doors',
  prop: 'props',
  poi: 'pois',
  trap: 'traps',
  stairs: 'stairs',
};

/** Резолверы визуального стейта по типу сущности. Отсутствие записи — всегда 'default'. */
const STATE_RESOLVERS: Partial<Record<Entity['type'], (entity: Entity) => string>> = {
  door: entity => (entity.type === 'door' && entity.isOpen ? 'open' : 'default'),
  poi: entity => (entity.type === 'poi' && entity.charges === 0 ? 'depleted' : 'default'),
};

/** Читает spriteVariants шаблона сущности (если шаблон и поле существуют). */
function getTemplateSpriteVariants(entity: Entity): Record<string, string> | undefined {
  switch (entity.type) {
    case 'door':
      return tryGetDoor(entity.templateId)?.spriteVariants;
    case 'prop':
      return tryGetProp(entity.templateId)?.spriteVariants;
    case 'poi':
      return tryGetPoi(entity.templateId)?.spriteVariants;
    case 'trap':
      return tryGetTrap(entity.templateId)?.spriteVariants;
    case 'stairs':
      return tryGetStairs(entity.templateId)?.spriteVariants;
    default:
      return undefined;
  }
}

/** Вычисляет визуальный стейт сущности. */
export function getObjectSpriteState(entity: Entity): string {
  return STATE_RESOLVERS[entity.type]?.(entity) ?? 'default';
}

/**
 * Разрешает путь к спрайту одной сущности.
 * Возвращает null для типов без категории спрайтов (акторы, предметы на полу).
 */
export function resolveEntitySprite(entity: Entity): string | null {
  const category = CATEGORY_BY_TYPE[entity.type];
  if (!category) return null;
  const state = getObjectSpriteState(entity);
  const variants = getTemplateSpriteVariants(entity);
  let override = variants?.[state];
  // Legacy: кастомный спрайт открытой двери из openSpriteId (до появления spriteVariants).
  if (!override && entity.type === 'door' && state === 'open') {
    override = tryGetDoor(entity.templateId)?.openSpriteId;
  }
  return resolveObjectSprite(category, entity.templateId, state, override);
}

/**
 * Предвычисляет пути к спрайтам всех объектов окружения (entityId → путь),
 * чтобы UI не обращался к Content-реестру напрямую.
 */
export function buildObjectSprites(state: GameState): Map<string, string> {
  const sprites = new Map<string, string>();
  for (const entity of state.entities.values()) {
    // Разрушенные двери не рендерятся — спрайт для них не нужен.
    if (entity.type === 'door' && entity.isAlive === false) continue;
    const path = resolveEntitySprite(entity);
    if (path) sprites.set(entity.id, path);
  }
  return sprites;
}
