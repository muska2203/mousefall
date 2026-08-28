import {StatusEffect, StatusEffectType} from '@simulation/types';
import {TickStatusEffectsIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';

/**
 * Тикает длительность статус-эффектов (duration -= 1) и порождает STATUS_TICKED.
 *
 * Снятия истёкших статусов здесь НЕТ: оно выполняется отдельным интентом
 * REMOVE_EXPIRED_STATUS_EFFECTS после разрешения реакций на STATUS_TICKED.
 * Иначе правила из ruleIds статуса вырезались бы из activeRules до обработки
 * события (реакции читают activeRules в момент реакции, волновая модель) —
 * и последний тик терял бы эффект (прецедент: status_bleeding_tick_damage,
 * исправлено 2026-08-28).
 */
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

  const node = builder.addChild(parent, {
    type: 'STATUS_TICKED', isFieldEvent: true,
    entityId: entity.id,
    effectTypes: tickedEffectTypes,
    tags: tickedEffectTypes.map((t) => `status.${t}`),
  });

  return node;
};
