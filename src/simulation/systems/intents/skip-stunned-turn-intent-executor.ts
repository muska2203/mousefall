import { GameState, StatusEffect } from '@simulation/types';
import { SkipStunnedTurnIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { findEntity, isActor } from '@simulation/state';
import { removeActiveRulesForStatus } from '@simulation/systems/rules/active-rule-lifecycle';

/**
 * Исполняет интент пропуска хода оглушённым актором.
 *
 * Контракт:
 * - Тикает эффект stunned на 1.
 * - Если длительность stunned стала 0 — удаляет эффект.
 * - Обнуляет AP актора.
 * - Порождает события STATUS_TICKED, STATUS_REMOVED (при истечении) и RESOURCE_CONSUMED.
 */
export const executeSkipStunnedTurnIntent: IntentExecutor<SkipStunnedTurnIntent> = (
  state: GameState,
  intent: SkipStunnedTurnIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !('statusEffects' in entity) || !('ap' in entity)) return null;

  const holder = entity as unknown as { statusEffects: StatusEffect[]; ap: number };
  const index = holder.statusEffects.findIndex(e => e.type === 'stunned');
  if (index < 0) return null;

  const effect = holder.statusEffects[index]!;
  effect.duration -= 1;

  const tickNode = builder.addChild(parent, {
    type: 'STATUS_TICKED',
    entityId: entity.id,
    effectTypes: ['stunned'],
    tags: ['status.stunned'],
  });

  if (effect.duration <= 0) {
    if (isActor(entity)) {
      removeActiveRulesForStatus(entity, effect.instanceId ?? effect.type);
    }
    holder.statusEffects.splice(index, 1);
    builder.addChild(tickNode, {
      type: 'STATUS_REMOVED',
      entityId: entity.id,
      effectType: 'stunned',
    });
  }

  const apBefore = holder.ap;
  holder.ap = 0;

  builder.addChild(tickNode, {
    type: 'RESOURCE_CONSUMED',
    entityId: entity.id,
    resource: 'ap',
    amount: apBefore,
    remaining: 0,
  });

  return tickNode;
};
