import { GameState } from '@simulation/types';
import { TickStatusEffectsIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';
import { executeDamage } from '@simulation/systems/damage/damage-processor';

export const executeTickStatusEffectsIntent: IntentExecutor<TickStatusEffectsIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = state.entities.get(intent.entityId) ?? state.player;
  if (!entity || !('statusEffects' in entity)) return null;

  const holder = entity as unknown as { statusEffects: Array<{ type: string; duration: number; value: number }> };
  let damageNode: ExecutionNode | null = null;

  for (const effect of holder.statusEffects) {
    switch (effect.type) {
      case 'burning': {
        const maxHp = 'maxHp' in entity ? entity.maxHp : 0;
        const rawDamage = Math.max(1, Math.round(maxHp * 0.1));
        const node = executeDamage(state, entity.id, rawDamage, 'fire', null, builder, damageNode ?? parent);
        if (node) damageNode = node;
        effect.duration -= 1;
        break;
      }
      case 'stunned': {
        // Оглушение тикает отдельно при пропуске хода актора,
        // чтобы гарантировать ровно один пропущенный ход.
        break;
      }
      default: {
        effect.duration -= 1;
        break;
      }
    }
  }

  const expired = holder.statusEffects.filter(e => e.duration <= 0);
  holder.statusEffects = holder.statusEffects.filter(e => e.duration > 0);

  const node = damageNode ?? parent;

  for (const effect of expired) {
    builder.addChild(node, {
      type: 'STATUS_REMOVED',
      entityId: entity.id,
      effectType: effect.type as import('@simulation/core-types').StatusEffectType,
    });
  }

  return damageNode;
};
