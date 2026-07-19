import {SetCooldownIntent} from "@simulation/core-types.ts";
import {IntentExecutor} from "@simulation/systems/intents/types.ts";

export const executeSetCooldownIntent: IntentExecutor<SetCooldownIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || !('abilities' in actor)) return null;

  const runtimeAbility = actor.abilities.find(a => a.templateId === intent.abilityId);
  if (runtimeAbility) {
    runtimeAbility.currentCooldown = intent.turns;
  }

  return builder.addChild(parent, {
    type: 'COOLDOWN_SET',
    entityId: intent.entityId,
    abilityId: intent.abilityId,
    turns: intent.turns,
  });
};
