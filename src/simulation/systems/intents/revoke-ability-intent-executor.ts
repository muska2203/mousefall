/**
 * Исполнитель интента REVOKE_ABILITY.
 *
 * Удаляет из массива abilities актёра запись с указанным sourceItemInstanceId.
 *
 * Ограничение: этот интент предназначен только для способностей, полученных от
 * предмета (source === 'equipment' и заполнен sourceItemInstanceId). Innate- и
 * levelup-способности не имеют sourceItemInstanceId, поэтому их отзыв через этот
 * интент не поддерживается.
 */

import { GameState, Actor } from "@simulation/types.ts";
import { IntentExecutor, RevokeAbilityIntent } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { removeActiveRulesForAbility } from "@simulation/systems/rules/active-rule-lifecycle.ts";

export const executeRevokeAbilityIntent: IntentExecutor<RevokeAbilityIntent> = (
  state: GameState,
  intent: RevokeAbilityIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || (actor.type !== 'player' && actor.type !== 'enemy')) return null;

  // REVOKE_ABILITY работает только со способностями, привязанными к экземпляру предмета.
  // Способности без sourceItemInstanceId (innate / levelup) нельзя отозвать этим интентом.
  if (!intent.sourceItemInstanceId) return null;

  const ability = actor.abilities.find(a => a.sourceItemInstanceId === intent.sourceItemInstanceId);
  if (!ability) return null;

  removeActiveRulesForAbility(actor as Actor, ability);

  actor.abilities = actor.abilities.filter(a => a.sourceItemInstanceId !== intent.sourceItemInstanceId);

  return builder.addChild(parent, {
    type: 'ABILITY_REVOKED',
    entityId: intent.entityId,
    abilityId: ability.templateId,
    sourceItemInstanceId: intent.sourceItemInstanceId,
  });
};
