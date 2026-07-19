/**
 * Исполнитель интента TELEPORT_ENTITY.
 *
 * Контракт:
 * - Находит сущность по `entityId`.
 * - Устанавливает `entity.x` / `entity.y` без проверок проходимости.
 * - Порождает событие ENTITY_MOVED с `movementType: 'teleport'`.
 */

import {GameState} from '@simulation/types';
import {ExecutionBuilder, ExecutionNode, TeleportEntityIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {findEntity} from '@simulation/state';
import {PLAYER_ID} from '@utils/constants';

export const executeTeleportEntityIntent: IntentExecutor<TeleportEntityIntent> = (
  state: GameState,
  intent: TeleportEntityIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity) {
    return null;
  }

  const from = { x: entity.x, y: entity.y };
  const to = { x: intent.x, y: intent.y };

  entity.x = to.x;
  entity.y = to.y;

  if (intent.entityId === PLAYER_ID && entity.type === 'player') {
    state.player = entity;
  }

  return builder.addChild(parent, {
    type: 'ENTITY_MOVED',
    entityId: intent.entityId,
    from,
    to,
    movementType: 'teleport',
  });
};
