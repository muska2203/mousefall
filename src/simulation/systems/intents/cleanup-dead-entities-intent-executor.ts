import { GameState } from '@simulation/types';
import {
  CleanupDeadEntitiesIntent,
  ExecutionBuilder,
  ExecutionNode,
  Position,
} from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { PLAYER_ID } from '@utils/constants';

/**
 * Удаляет всех мёртвых не-игроковых сущностей из state.entities.
 *
 * Контракт:
 * - Сканирует state.entities и физически удаляет сущности с isAlive === false (кроме игрока).
 * - Сохраняет детерминированный порядок удаления (сортировка по entityId).
 * - Порождает событие DEAD_ENTITIES_CLEANED с массивом удалённых сущностей.
 * - Если мёртвых сущностей нет, возвращает null и не создаёт событие.
 */
export const executeCleanupDeadEntitiesIntent: IntentExecutor<CleanupDeadEntitiesIntent> = (
  state: GameState,
  intent: CleanupDeadEntitiesIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const removed: { entityId: string; position: Position }[] = [];

  // Собираем мёртвых не-игроковых сущностей перед удалением,
  // чтобы порядок обработки был детерминированным между запусками.
  const deadEntities = Array.from(state.entities.entries())
    .filter(([id, entity]) => id !== PLAYER_ID && 'isAlive' in entity && entity.isAlive === false)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [id, entity] of deadEntities) {
    removed.push({ entityId: id, position: { x: entity.x, y: entity.y } });
    state.entities.delete(id);
  }

  if (removed.length === 0) {
    return null;
  }

  return builder.addChild(parent, {
    type: 'DEAD_ENTITIES_CLEANED',
    removed,
  });
};
