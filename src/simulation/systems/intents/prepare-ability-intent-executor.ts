import { GameState } from '@simulation/types';
import { PrepareAbilityIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';
import { isEnemyEntity } from '@simulation/ai/ai-state';

/**
 * Исполнитель интента подготовки скилла AI.
 *
 * Сохраняет намерение в aiState врага и уведомляет presentation-слой
 * через событие ABILITY_PREPARED. Зона поражения не кэшируется здесь —
 * её при необходимости вычисляет Presentation через публичный API Simulation.
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

  entity.aiState.preparedIntent = {
    abilityId: intent.abilityId,
    fixedTargets: intent.targets,
  };

  return builder.addChild(parent, {
    type: 'ABILITY_PREPARED',
    entityId: intent.entityId,
    abilityId: intent.abilityId,
    targets: intent.targets,
    from: { x: entity.x, y: entity.y },
  });
};
