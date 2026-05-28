/**
 * Исполнитель интента REVOKE_ABILITY.
 *
 * Удаляет из массива abilities актёра запись с указанным sourceItemInstanceId.
 */

import { GameState } from "@simulation/types.ts";
import { IntentExecutor, RevokeAbilityIntent } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";

export const executeRevokeAbilityIntent: IntentExecutor<RevokeAbilityIntent> = (
  state: GameState,
  intent: RevokeAbilityIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || (actor.type !== 'player' && actor.type !== 'enemy')) return null;

  const ability = actor.abilities.find(a => a.sourceItemInstanceId === intent.sourceItemInstanceId);
  if (!ability) return null;

  actor.abilities = actor.abilities.filter(a => a.sourceItemInstanceId !== intent.sourceItemInstanceId);

  return builder.addChild(parent, {
    type: 'ABILITY_REVOKED',
    entityId: intent.entityId,
    abilityId: ability.templateId,
    sourceItemInstanceId: intent.sourceItemInstanceId,
  });
};
