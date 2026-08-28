import {StatActor, StatusEffect} from '@simulation/types';
import {RemoveExpiredStatusEffectsIntent} from '@simulation/core-types';
import {IntentExecutor} from '@simulation/systems/intents/types';
import {isActor} from '@simulation/state';
import {removeActiveRulesForStatus} from '@simulation/systems/rules/active-rule-lifecycle';
import {removeStatusStatModifiers} from '@simulation/systems/statuses/status-stat-modifiers';

/**
 * Снимает статусы с истёкшей длительностью (duration <= 0).
 *
 * Выделен из TICK_STATUS_EFFECTS в отдельный интент, исполняемый после
 * разрешения реакций на STATUS_TICKED: реакции собирают activeRules цели
 * в момент обработки события, поэтому снятие внутри тика вырезало правила
 * из ruleIds статуса до срабатывания — последний тик терял эффект
 * (прецедент: status_bleeding_tick_damage, исправлено 2026-08-28).
 *
 * Порождает STATUS_REMOVED для каждого снятого статуса.
 * Если истёкших статусов нет — возвращает null без событий.
 */
export const executeRemoveExpiredStatusEffectsIntent: IntentExecutor<RemoveExpiredStatusEffectsIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = state.entities.get(intent.entityId) ?? state.player;
  if (!entity || !('statusEffects' in entity)) return null;

  const holder = entity as unknown as { statusEffects: StatusEffect[] };
  const expired = holder.statusEffects.filter(e => e.duration <= 0);
  if (expired.length === 0) return null;

  if (isActor(entity)) {
    for (const effect of expired) {
      removeActiveRulesForStatus(entity, effect.instanceId ?? effect.type);
      removeStatusStatModifiers(entity as unknown as StatActor, effect);
    }
  }

  holder.statusEffects = holder.statusEffects.filter(e => e.duration > 0);

  let node = parent;
  for (const effect of expired) {
    node = builder.addChild(parent, {
      type: 'STATUS_REMOVED', isFieldEvent: true,
      entityId: entity.id,
      effectType: effect.type,
    });
  }

  return node;
};
