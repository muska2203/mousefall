import { GameState } from '@simulation/types';
import { BeginCastIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';

export const executeBeginCastIntent: IntentExecutor<BeginCastIntent> = (
  state: GameState,
  intent: BeginCastIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const actor = findEntity(state, intent.entityId);
  if (!actor || !('activeCast' in actor)) return null;

  (actor as { activeCast: { abilityId: string; fixedTargets: { x: number; y: number }[]; remainingTurns: number } | null }).activeCast = {
    abilityId: intent.abilityId,
    fixedTargets: intent.targets,
    remainingTurns: intent.turns,
  };

  return builder.addChild(parent, {
    type: 'CAST_STARTED',
    entityId: intent.entityId,
    abilityId: intent.abilityId,
    turns: intent.turns,
    targets: intent.targets,
    from: { x: actor.x, y: actor.y },
  });
};
