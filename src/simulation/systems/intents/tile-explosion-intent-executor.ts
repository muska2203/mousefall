/**
 * Исполнитель площадного взрыва по клеткам.
 *
 * Не наносит урон напрямую: порождает семантическое событие TILE_EXPLODED,
 * на которое мировая реакция превращает в DAMAGE_TILE по всем клеткам в радиусе.
 * Так соблюдается правило: IntentExecutor выполняет одно действие и не исполняет
 * другие интенты самостоятельно.
 */

import type {GameState} from '@simulation/types.ts';
import type {TileExplosionIntent, IntentExecutor} from '@simulation/systems/intents/types.ts';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';

export const executeTileExplosionIntent: IntentExecutor<TileExplosionIntent> = (
  state: GameState,
  intent: TileExplosionIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;

  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return null;
  }

  return builder.addChild(parent, {
    type: 'TILE_EXPLODED',
    position: { x, y },
    sourceEntityId: intent.sourceEntityId,
    damage: intent.damage,
    radius: intent.radius,
    tags: intent.tags,
  });
};
