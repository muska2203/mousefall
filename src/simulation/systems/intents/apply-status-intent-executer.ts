import { GameState, StatusEffectHolder } from '@simulation/types';
import { ApplyStatusIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';

export const executeApplyStatusIntent: IntentExecutor<ApplyStatusIntent> = (
  state: GameState,
  intent: ApplyStatusIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findEntity(state, intent.entityId);
  if (!target || !('statusEffects' in target)) return null;

  const holder = target as unknown as StatusEffectHolder;

  // Проверяем дубликаты: если эффект того же типа уже есть — обновляем duration
  const existingIndex = holder.statusEffects.findIndex((e: { type: string }) => e.type === intent.status.type);
  if (existingIndex >= 0) {
    holder.statusEffects[existingIndex] = {
      ...holder.statusEffects[existingIndex]!,
      duration: intent.status.duration,
    };
  } else {
    holder.statusEffects.push(intent.status);
  }

  return builder.addChild(parent, {
    type: 'STATUS_APPLIED',
    entityId: intent.entityId,
    effect: intent.status,
  });
};
