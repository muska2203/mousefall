/**
 * Исполнитель интента SET_ENTITIES.
 *
 * Контракт:
 * - Заменяет `state.entities` на коллекцию из интента.
 * - Гарантирует присутствие игрока в новой коллекции.
 * - Порождает событие ENTITIES_REPLACED с отсортированным списком ID.
 */

import {Entity, EntityId, GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, SetEntitiesIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {PLAYER_ID} from '@utils/constants';

export const executeSetEntitiesIntent: IntentExecutor<SetEntitiesIntent> = (
  state: GameState,
  intent: SetEntitiesIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  if (!intent.entities.has(PLAYER_ID)) {
    return null;
  }

  const entities = intent.entities as Map<EntityId, Entity>;
  state.entities = entities;

  // Синхронизируем state.player, чтобы ссылка гарантированно совпадала
  // с сущностью в коллекции.
  const player = state.entities.get(PLAYER_ID);
  if (player && player.type === 'player') {
    state.player = player;
  }

  const entityIds = Array.from(entities.keys()).sort((a, b) => a.localeCompare(b));

  return builder.addChild(parent, {
    type: 'ENTITIES_REPLACED',
    entityIds,
  });
};
