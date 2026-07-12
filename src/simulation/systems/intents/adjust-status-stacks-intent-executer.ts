import { GameState, StatusEffectHolder } from '@simulation/types';
import { AdjustStatusStacksIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity, isActor } from '@simulation/state';
import { removeActiveRulesForStatus } from '@simulation/systems/rules/active-rule-lifecycle';

/**
 * Изменяет количество стаков указанного статуса на сущности.
 * Если стаки падают до 0 или ниже — статус удаляется.
 */
export const executeAdjustStatusStacksIntent: IntentExecutor<AdjustStatusStacksIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !('statusEffects' in entity)) return null;

  const holder = entity as unknown as StatusEffectHolder;
  const index = holder.statusEffects.findIndex(effect => effect.type === intent.statusType);
  if (index < 0) return null;

  const effect = holder.statusEffects[index]!;
  const currentStacks = effect.stacks ?? 1;
  const newStacks = currentStacks + intent.delta;

  if (newStacks <= 0) {
    if (isActor(entity)) {
      removeActiveRulesForStatus(entity, effect.instanceId ?? effect.type);
    }
    holder.statusEffects.splice(index, 1);
    return builder.addChild(parent, {
      type: 'STATUS_REMOVED',
      entityId: entity.id,
      effectType: intent.statusType,
    });
  }

  effect.stacks = newStacks;
  return builder.addChild(parent, {
    type: 'STATUS_STACKS_ADJUSTED',
    entityId: entity.id,
    statusType: intent.statusType,
    stacks: newStacks,
  });
};
