import { GameState } from '@simulation/types';
import { TickCooldownIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { findEntity } from '@simulation/state';

/**
 * Уменьшает кулдаун способности актора на 1.
 *
 * Контракт:
 * - currentCooldown уменьшается на 1, но не ниже 0.
 * - Порождает событие COOLDOWN_TICKED.
 */
export const executeTickCooldownIntent: IntentExecutor<TickCooldownIntent> = (
  state: GameState,
  intent: TickCooldownIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const entity = findEntity(state, intent.entityId);
  if (!entity || !('abilities' in entity)) return null;

  const actor = entity as { abilities: Array<{ templateId: string; currentCooldown: number }> };
  const ability = actor.abilities.find(a => a.templateId === intent.abilityId);
  if (!ability) return null;

  ability.currentCooldown = Math.max(0, ability.currentCooldown - 1);

  return builder.addChild(parent, {
    type: 'COOLDOWN_TICKED',
    entityId: intent.entityId,
    abilityId: intent.abilityId,
    remaining: ability.currentCooldown,
  });
};
