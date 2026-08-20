/**
 * Запросы видимости сущностей по DisplayState.
 *
 * Отдельно от гридов visible/explored: сокрытие (concealsEntities у тайловых
 * эффектов — взвешанная мука и т.п.) не влияет на FOV-грид, а скрывает саму
 * сущность на клетке. Правило симметрично движковому (см. isEntityConcealedFrom
 * в simulation/state.ts): сущность на concealing-клетке видна наблюдателю
 * только с дистанции ≤ 1 (Чебышёв).
 */

import {tryGetTileEffect} from '@content/registry';
import type {DisplayEntity, DisplayState} from './types';

/**
 * Возвращает true, если сущность скрыта от игрока сокрытием:
 * на её клетке есть тайловый эффект с concealsEntities и игрок дальше 1 клетки.
 */
export function isEntityConcealedFromPlayer(displayState: DisplayState, entity: DisplayEntity): boolean {
  const tile = displayState.map.tiles[entity.y]?.[entity.x];
  const overlays = tile?.tileEffects;
  if (!overlays || overlays.length === 0) return false;
  const conceals = overlays.some((overlay) => tryGetTileEffect(overlay.type)?.concealsEntities === true);
  if (!conceals) return false;
  const player = displayState.player;
  const dx = Math.abs(entity.x - player.x);
  const dy = Math.abs(entity.y - player.y);
  return Math.max(dx, dy) > 1;
}
