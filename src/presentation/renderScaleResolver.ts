/**
 * Разрешение масштаба отрисовки сущностей из Content Registry.
 *
 * Ответственность Presentation Layer: перевод templateId → renderScale.
 * UI вызывает эту функцию, не обращаясь к реестру напрямую.
 */

import {tryGetDoor, tryGetEntity, tryGetPlayerTemplate, tryGetStairs} from '@content/registry';

/** Масштаб по умолчанию для не-акторов. */
const DEFAULT_RENDER_SCALE = 1.0;

/** Масштаб по умолчанию для акторов (игрок, враги). */
const ACTOR_DEFAULT_RENDER_SCALE = 1.5;

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
  const fromPlayer = tryGetPlayerTemplate(templateId);
  if (fromPlayer) {
    return fromPlayer.renderScale;
  }
  const fromDoor = tryGetDoor(templateId);
  if (fromDoor) {
    return fromDoor.renderScale;
  }
  return isActor ? ACTOR_DEFAULT_RENDER_SCALE : DEFAULT_RENDER_SCALE;
}
