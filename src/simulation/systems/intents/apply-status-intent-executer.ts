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

  // Проверяем дубликаты: если эффект того же типа уже есть — обновляем duration.
  // Для стакующихся статусов суммируем стаки.
  const existingIndex = holder.statusEffects.findIndex((e: { type: string }) => e.type === intent.status.type);
  if (existingIndex >= 0) {
    const existing = holder.statusEffects[existingIndex]!;
    const incomingStacks = intent.status.stacks;
    const newStacks = incomingStacks !== undefined
      ? (existing.stacks ?? 1) + incomingStacks
      : existing.stacks;
    holder.statusEffects[existingIndex] = {
      ...existing,
      duration: intent.status.duration,
      ...(newStacks !== undefined ? { stacks: newStacks } : {}),
    };
  } else {
    holder.statusEffects.push(intent.status);
  }

  // Прерывание подготовки AI-намерения при стане
  if (intent.status.type === 'stunned' && 'aiState' in target && target.aiState && target.aiState.preparedIntent) {
    const { abilityId, fixedTargets } = target.aiState.preparedIntent;
    target.aiState.preparedIntent = null;
    builder.addChild(parent, {
      type: 'ABILITY_PREPARED_CANCELLED',
      entityId: intent.entityId,
      abilityId,
      targets: fixedTargets,
      from: { x: target.x, y: target.y },
    });
  }

  return builder.addChild(parent, {
    type: 'STATUS_APPLIED',
    entityId: intent.entityId,
    effect: intent.status,
  });
};
