/**
 * Разрешение размещения спрайтов из Content Registry.
 *
 * Ответственность Presentation Layer: перевод templateId + категория → ResolvedSpritePlacement.
 * UI вызывает эту функцию, не обращаясь к реестру напрямую.
 *
 * Дефолты категорий соответствуют прежним константам позиционирования
 * (STANDING_Y_FACTOR, TILE_EFFECT_STATUS_SPRITE_SCALE и т.д.) —
 * визуальное поведение по умолчанию не меняется. Шаблон может переопределить
 * любое поле через опциональное `placement` (см. SpritePlacementSchema).
 */

import type {SpritePlacement} from '@content/schemas';
import {
  tryGetDoor,
  tryGetEntity,
  tryGetPlayerTemplate,
  tryGetPoi,
  tryGetProp,
  tryGetStairs,
  tryGetTileEffect,
  tryGetTileEffectStatus,
  tryGetTrap,
} from '@content/registry';

/** Категория отображаемого спрайта: определяет дефолт размещения. */
export type SpritePlacementCategory =
  | 'actor'
  | 'object'
  | 'trap'
  | 'tileEffectCover'
  | 'tileEffectAboveGround'
  | 'tileEffectStatus'
  | 'terrainStanding';

/** Размещение спрайта со всеми разрешёнными значениями. */
export type ResolvedSpritePlacement = Required<SpritePlacement>;

/**
 * Дефолты размещения по категориям (соответствуют прежнему поведению):
 * - actor / object — низ спрайта на 0.8 высоты сжатой клетки (акторы — опора
 *   по центру X, объекты — по левому краю);
 * - trap / tileEffectCover — сплющены в плоскость пола;
 * - tileEffectAboveGround — «стоя» в полный размер (дым и т.п.);
 * - tileEffectStatus — уменьшенный значок над эффектом;
 * - terrainStanding — стены: полный размер, низ к низу клетки.
 */
const CATEGORY_DEFAULTS: Record<SpritePlacementCategory, ResolvedSpritePlacement> = {
  actor:                 {scale: 1.0, anchorX: 0.5, anchorY: 0.8, flattenY: false},
  object:                {scale: 1.0, anchorX: 0,   anchorY: 0.8, flattenY: false},
  trap:                  {scale: 1.0, anchorX: 0,   anchorY: 0,   flattenY: true},
  tileEffectCover:       {scale: 1.0, anchorX: 0,   anchorY: 0,   flattenY: true},
  tileEffectAboveGround: {scale: 1.0, anchorX: 0,   anchorY: 0.8, flattenY: false},
  tileEffectStatus:      {scale: 0.7, anchorX: 0.5, anchorY: 0.5, flattenY: false},
  terrainStanding:       {scale: 1.0, anchorX: 0,   anchorY: 1.0, flattenY: false},
};

/** Шаблон, из которого можно прочитать переопределение размещения. */
type PlacementCarrier = {
  placement?: SpritePlacement;
};

/** Найти шаблон по templateId среди категорий, подходящих для данной категории спрайта. */
function lookupTemplate(
  templateId: string,
  category: SpritePlacementCategory,
): PlacementCarrier | undefined {
  switch (category) {
    case 'actor':
      return tryGetEntity(templateId) ?? tryGetPlayerTemplate(templateId);
    case 'object':
      return (
        tryGetStairs(templateId) ??
        tryGetDoor(templateId) ??
        tryGetProp(templateId) ??
        tryGetPoi(templateId)
      );
    case 'trap':
      return tryGetTrap(templateId);
    case 'tileEffectCover':
    case 'tileEffectAboveGround':
      return tryGetTileEffect(templateId);
    case 'tileEffectStatus':
      return tryGetTileEffectStatus(templateId);
    case 'terrainStanding':
      // У террейна нет поля placement: «стоячесть» задаётся флагом standing.
      return undefined;
  }
}

/**
 * Вернуть размещение спрайта: дефолт категории, скорректированный полем
 * `placement` шаблона (неуказанные поля — из дефолта категории).
 * @param templateId — templateId сущности/эффекта; undefined — чистый дефолт категории.
 * @param category — категория спрайта (для эффектов — по слою: cover → tileEffectCover и т.д.).
 */
export function getSpritePlacement(
  templateId: string | undefined,
  category: SpritePlacementCategory,
): ResolvedSpritePlacement {
  const base = CATEGORY_DEFAULTS[category];
  const template = templateId ? lookupTemplate(templateId, category) : undefined;
  if (!template) {
    return {...base};
  }
  const override = template.placement;
  return {
    scale: override?.scale ?? base.scale,
    anchorX: override?.anchorX ?? base.anchorX,
    anchorY: override?.anchorY ?? base.anchorY,
    flattenY: override?.flattenY ?? base.flattenY,
  };
}
