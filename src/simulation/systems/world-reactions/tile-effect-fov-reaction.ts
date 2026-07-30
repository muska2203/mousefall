/**
 * Реакция мира: появление или исчезновение тайлового эффекта с blocksLOS
 * (дым и т.п.) инвалидирует поле зрения.
 *
 * Без этой реакции FOV пересчитывался бы только после действий игрока,
 * и дым визуально не работал бы до следующего хода.
 *
 * Продление длительности существующего эффекта (TILE_EFFECT_CHANGED с
 * isNew === false) обзор не меняет и пересчёта не требует.
 */

import type {GameEvent, GameState, Intent} from '@simulation/types.ts';
import type {WorldReaction} from '@simulation/systems/world-reactions/types.ts';
import {tryGetTileEffect} from '@content/registry.ts';

export const tileEffectFovReaction: WorldReaction = (
  _state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'TILE_EFFECT_CHANGED' && event.type !== 'TILE_EFFECT_REMOVED') {
    return [];
  }

  if (event.type === 'TILE_EFFECT_CHANGED' && !event.isNew) {
    return [];
  }

  if (tryGetTileEffect(event.effectType)?.blocksLOS !== true) {
    return [];
  }

  return [{ type: 'UPDATE_FOG' }];
};
