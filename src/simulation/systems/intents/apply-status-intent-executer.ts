import {EnemyEntity, GameState, StatusEffectHolder} from '@simulation/types';
import {ApplyStatusIntent, IntentExecutor} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {findEntity, isActor, nextEntityId} from '@simulation/state';
import {isEnemyEntity} from '@simulation/ai/ai-state';
import {addActiveRulesForStatus, removeActiveRulesForStatus} from '@simulation/systems/rules/active-rule-lifecycle';
import {cancelPreparedAbility} from '@simulation/ai/ai-helpers';
import {getStatusTemplate} from '@simulation/systems/statuses/status-template';
import {resolveStatusConflicts} from '@simulation/systems/statuses/resolve-status-conflicts';
import type {StatusEffectType} from '@simulation/core-types';

export const executeApplyStatusIntent: IntentExecutor<ApplyStatusIntent> = (
  state: GameState,
  intent: ApplyStatusIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const target = findEntity(state, intent.entityId);
  if (!target || !('statusEffects' in target)) return null;

  if (!isActor(target)) {
    // Не-акторы не получают статусы.
    return null;
  }

  const holder = target as unknown as StatusEffectHolder;
  const template = getStatusTemplate(intent.status.type);

  // Разрешаем конфликты blockedBy / mutuallyExclusiveWith через общий хелпер.
  const conflictResult = resolveStatusConflicts(
    holder.statusEffects,
    { blockedBy: template?.blockedBy ?? [], mutuallyExclusiveWith: template?.mutuallyExclusiveWith ?? [] },
  );

  if (conflictResult.blockedBy) {
    return builder.addChild(parent, {
      type: 'STATUS_BLOCKED',
      entityId: intent.entityId,
      sourceEntityId: intent.sourceEntityId ?? null,
      statusType: intent.status.type,
      blockedBy: conflictResult.blockedBy as StatusEffectType,
    });
  }

  for (const exclusiveType of conflictResult.removedTypes) {
    const index = holder.statusEffects.findIndex((e) => e.type === exclusiveType);
    if (index >= 0) {
      const [removed] = holder.statusEffects.splice(index, 1);
      if (removed && isActor(target)) {
        removeActiveRulesForStatus(target, removed.instanceId ?? removed.type);
      }
      builder.addChild(parent, {
        type: 'STATUS_REMOVED',
        entityId: intent.entityId,
        effectType: exclusiveType as StatusEffectType,
      });
    }
  }

  // Проверяем дубликаты: если эффект того же типа уже есть — обновляем duration.
  // Для стакующихся статусов суммируем стаки.
  // При обновлении длительности activeRules не трогаем.
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
    intent.status.instanceId = nextEntityId(state, 'status');
    holder.statusEffects.push(intent.status);

    if (isActor(target)) {
      addActiveRulesForStatus(target, intent.status.instanceId, intent.status.type);
    }
  }

  // Прерывание подготовки AI-способности при стане или немоте.
  if ((intent.status.type === 'stunned' || intent.status.type === 'silenced') && isEnemyEntity(target)) {
    const enemy = target as unknown as EnemyEntity;
    const prepared = cancelPreparedAbility(enemy);
    if (prepared) {
      builder.addChild(parent, {
        type: 'ABILITY_PREPARED_CANCELLED',
        entityId: intent.entityId,
        abilityId: prepared.abilityId,
        targets: prepared.targets,
        from: { x: target.x, y: target.y },
      });
    }
  }

  return builder.addChild(parent, {
    type: 'STATUS_APPLIED',
    entityId: intent.entityId,
    sourceEntityId: intent.sourceEntityId ?? null,
    effect: intent.status,
  });
};
