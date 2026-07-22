import {GameState} from '@simulation/types';
import {DamageTileIntent, IntentExecutor} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {findAllEntitiesAt, isDamageable} from '@simulation/state';
import {applyDamageToEntity} from '@simulation/systems/damage/apply-damage';

/**
 * Исполнитель площадного урона по клетке.
 *
 * Наносит урон всем damageable-сущностям в указанной позиции (эмитя ENTITY_DAMAGED
 * для каждой), а затем эмитит TILE_DAMAGED для самой клетки — независимо от того,
 * были ли в ней сущности. Благодаря этому эффекты окружения (например, поджог масла)
 * срабатывают даже на пустую клетку.
 */
export const executeDamageTileIntent: IntentExecutor<DamageTileIntent> = (
  state: GameState,
  intent: DamageTileIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;

  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return null;
  }

  const entitiesAtTile = findAllEntitiesAt(state, x, y);

  for (const entity of entitiesAtTile) {
    // Предметы на полу и лестницы не получают урон.
    if (entity.type === 'floor_item_container' || entity.type === 'stairs') continue;
    if (!isDamageable(entity)) continue;

    applyDamageToEntity(
      state,
      entity,
      intent.damage,
      intent.tags,
      intent.sourceEntityId,
      builder,
      parent,
    );
  }

  return builder.addChild(parent, {
    type: 'TILE_DAMAGED',
    position: { x, y },
    sourceEntityId: intent.sourceEntityId,
    damage: intent.damage,
    tags: intent.tags,
  });
};
