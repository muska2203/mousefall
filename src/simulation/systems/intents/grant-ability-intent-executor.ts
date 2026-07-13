/**
 * Исполнитель интента GRANT_ABILITY.
 *
 * Добавляет способность в массив abilities актёра.
 */

import { GameState, Actor } from "@simulation/types.ts";
import { isActor } from "@simulation/state.ts";
import { IntentExecutor, GrantAbilityIntent } from "@simulation/systems/intents/types.ts";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { addActiveRulesForAbility } from "@simulation/systems/rules/active-rule-lifecycle.ts";

export const executeGrantAbilityIntent: IntentExecutor<GrantAbilityIntent> = (
  state: GameState,
  intent: GrantAbilityIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || !isActor(actor)) return null;

  actor.abilities.push(intent.ability);
  addActiveRulesForAbility(actor as Actor, intent.ability);

  return builder.addChild(parent, {
    type: 'ABILITY_GRANTED',
    entityId: intent.entityId,
    abilityId: intent.ability.templateId,
    sourceItemInstanceId: intent.ability.sourceItemInstanceId!,
  });
};
