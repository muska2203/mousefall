/**
 * Реакция мира: взрыв по клетке наносит урон всем клеткам в радиусе.
 *
 * Превращает событие TILE_EXPLODED в набор DAMAGE_TILE-интентов.
 * Урон одинаковый для центра и периметра (требование правила масла).
 */

import type {GameEvent, GameState, Intent} from '@simulation/types.ts';
import type {WorldReaction} from '@simulation/systems/world-reactions/types.ts';

export const tileExplosionDamageReaction: WorldReaction = (
  _state: GameState,
  event: GameEvent,
): Intent[] => {
  if (event.type !== 'TILE_EXPLODED') {
    return [];
  }

  const intents: Intent[] = [];
  const { x, y } = event.position;
  const radius = event.radius;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      intents.push({
        type: 'DAMAGE_TILE',
        position: { x: x + dx, y: y + dy },
        sourceEntityId: event.sourceEntityId,
        damage: event.damage,
        tags: event.tags,
      });
    }
  }

  return intents;
};
