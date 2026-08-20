/**
 * Реакция мира: тайловый эффект взрывается при наложении статуса-триггера.
 *
 * Обобщение бывшей реакции «горящее масло взрывается»: параметры взрыва
 * (триггер, урон, радиус, теги, расходование эффекта) читаются из поля
 * `explosion` шаблона тайлового эффекта, а не захардкожены.
 *
 * Срабатывает только при первом наложении статуса (isNew === true),
 * чтобы не взрываться повторно при обновлении длительности.
 */

import type {GameEvent, GameState, Intent} from '@simulation/types.ts';
import type {WorldReaction} from '@simulation/systems/world-reactions/types.ts';
import {tryGetTileEffect} from '@content/registry';

export const tileEffectExplosionReaction: WorldReaction = (
  _state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'TILE_EFFECT_STATUS_APPLIED') {
    return [];
  }

  if (!event.isNew) {
    return [];
  }

  const template = tryGetTileEffect(event.effectType);
  const explosion = template?.explosion;
  if (!explosion || explosion.triggerStatus !== event.statusType) {
    return [];
  }

  const intents: Intent[] = [{
    type: 'TILE_EXPLOSION',
    position: event.position,
    sourceEntityId: null,
    damage: explosion.damage,
    radius: explosion.radius,
    tags: explosion.tags,
  }];

  if (explosion.consumesEffect) {
    intents.push({
      type: 'REMOVE_TILE_EFFECT',
      effectType: event.effectType,
      position: event.position,
    });
  }

  return intents;
};
