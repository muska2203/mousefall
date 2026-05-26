/**
 * Конфигурация масштабов отрисовки сущностей относительно TILE_SIZE.
 *
 * Правила:
 * - Масштаб читается из загруженного контента (шаблон сущности/лестницы/предмета).
 * - Если шаблон не найден — используется fallback:
 *   - Акторы (игрок, враги): 1.5
 *   - Не-акторы (предметы, лестницы): 1.0
 */

import { tryGetEntity, tryGetStairs, tryGetItem } from '@simulation/content/registry';

/** Масштаб по умолчанию для не-акторов. */
export const DEFAULT_RENDER_SCALE = 1.0;

/** Масштаб по умолчанию для акторов (игрок, враги). */
export const ACTOR_DEFAULT_RENDER_SCALE = 1.5;

/**
 * Вернуть масштаб отрисовки для сущности по её templateId.
 * @param templateId — templateId сущности.
 * @param isActor — является ли сущность актором (игрок/враг).
 */
export function getRenderScale(templateId: string, isActor: boolean): number {
  const fromEntity = tryGetEntity(templateId);
  if (fromEntity) {
    return fromEntity.renderScale;
  }
  const fromStairs = tryGetStairs(templateId);
  if (fromStairs) {
    return fromStairs.renderScale;
  }
  const fromItem = tryGetItem(templateId);
  if (fromItem && 'renderScale' in fromItem) {
    return (fromItem as any).renderScale ?? DEFAULT_RENDER_SCALE;
  }
  return isActor ? ACTOR_DEFAULT_RENDER_SCALE : DEFAULT_RENDER_SCALE;
}
