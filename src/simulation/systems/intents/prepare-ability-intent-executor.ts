import { GameState } from '@simulation/types';
import { PrepareAbilityIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';
import { isEnemyEntity } from '@simulation/ai/ai-state';

/**
 * Исполнитель интента подготовки скилла AI.
 *
 * Сохраняет намерение в aiState врага и уведомляет presentation-слой
 * через событие ABILITY_PREPARED. Зона поражения кэшируется в aiState,
 * чтобы presentation-слой не обращался к SkillExecutor напрямую.
 */
export const executePrepareAbilityIntent: IntentExecutor<PrepareAbilityIntent> = (
  state: GameState,
  intent: PrepareAbilityIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !isEnemyEntity(entity)) {
    return null;
  }

  const enemy = entity;
  const executor = getSkillExecutor(intent.abilityId);
  const affectedPositions = executor
    ? executor.getAffectedPositions(state, entity, intent.targets, intent.targets[0] ?? null)
    : [];

  enemy.aiState.preparedIntent = {
    abilityId: intent.abilityId,
    fixedTargets: intent.targets,
    affectedPositions,
  };

  return builder.addChild(parent, {
    type: 'ABILITY_PREPARED',
    entityId: intent.entityId,
    abilityId: intent.abilityId,
    targets: intent.targets,
    from: { x: entity.x, y: entity.y },
  });
};
