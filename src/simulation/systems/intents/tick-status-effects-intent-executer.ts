import {StatActor, StatusEffect, StatusEffectType} from '@simulation/types';
import {TickStatusEffectsIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {isActor} from '@simulation/state';
import {removeActiveRulesForStatus} from '@simulation/systems/rules/active-rule-lifecycle';
import {removeStatusStatModifiers} from '@simulation/systems/statuses/status-stat-modifiers';

export const executeTickStatusEffectsIntent: IntentExecutor<TickStatusEffectsIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = state.entities.get(intent.entityId) ?? state.player;
  if (!entity || !('statusEffects' in entity)) return null;

  const holder = entity as unknown as { statusEffects: StatusEffect[] };
  const tickedEffectTypes: StatusEffectType[] = [];

  for (const effect of holder.statusEffects) {
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

  if (isActor(entity)) {
    for (const effect of expired) {
      removeActiveRulesForStatus(entity, effect.instanceId ?? effect.type);
      removeStatusStatModifiers(entity as unknown as StatActor, effect);
    }
  }

  holder.statusEffects = holder.statusEffects.filter(e => e.duration > 0);

  const node = builder.addChild(parent, {
    type: 'STATUS_TICKED', isFieldEvent: true,
    entityId: entity.id,
    effectTypes: tickedEffectTypes,
    tags: tickedEffectTypes.map((t) => `status.${t}`),
  });

  for (const effect of expired) {
    builder.addChild(node, {
      type: 'STATUS_REMOVED', isFieldEvent: true,
      entityId: entity.id,
      effectType: effect.type,
    });
  }

  return node;
};
