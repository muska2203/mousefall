import { GameState, StatusEffect, StatusEffectType } from '@simulation/types';
import { TickStatusEffectsIntent, ExecutionBuilder, ExecutionNode } from '@simulation/core-types';
import { IntentExecutor } from '@simulation/systems/intents/types';

export const executeTickStatusEffectsIntent: IntentExecutor<TickStatusEffectsIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = state.entities.get(intent.entityId) ?? state.player;
  if (!entity || !('statusEffects' in entity)) return null;

  const intentPhase = intent.phase ?? 'environment';
  const holder = entity as unknown as { statusEffects: StatusEffect[] };
  const tickedEffectTypes: StatusEffectType[] = [];

  for (const effect of holder.statusEffects) {
    const effectPhase = effect.tickAfter ?? 'environment';
    if (effectPhase !== intentPhase) continue;

    switch (effect.type) {
      case 'burning': {
        tickedEffectTypes.push('burning');
        effect.duration -= 1;
        break;
      }
      case 'stunned': {
        // Оглушение тикает отдельно через интент SKIP_STUNNED_TURN,
        // чтобы гарантировать ровно один пропущенный ход.
        break;
      }
      default: {
        if (!tickedEffectTypes.includes(effect.type)) {
          tickedEffectTypes.push(effect.type);
        }
        effect.duration -= 1;
        break;
      }
    }
  }

  const expired = holder.statusEffects.filter(e => e.duration <= 0);
  holder.statusEffects = holder.statusEffects.filter(e => e.duration > 0);

  const node = builder.addChild(parent, {
    type: 'STATUS_TICKED',
    entityId: entity.id,
    effectTypes: tickedEffectTypes,
  });

  for (const effect of expired) {
    builder.addChild(node, {
      type: 'STATUS_REMOVED',
      entityId: entity.id,
      effectType: effect.type,
    });
  }

  return node;
};
