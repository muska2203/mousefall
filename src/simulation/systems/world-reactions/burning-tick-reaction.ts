import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { isContentRulesEnabled } from '@simulation/content-rules/feature-flags.ts';

/**
 * Реакция мира: при тике эффекта горения актор получает урон от огня.
 * Урон рассчитывается как 10% от максимального HP, но не менее 1.
 * Отключается при включённой системе контентных правил.
 */
export const burningTickReaction: WorldReaction = (state, event) => {
  if (isContentRulesEnabled(state)) return [];
  if (event.type !== 'STATUS_TICKED') return [];
  if (!event.effectTypes.includes('burning')) return [];

  const entity = findEntity(state, event.entityId);
  if (!entity || !('maxHp' in entity)) return [];

  const maxHp = entity.maxHp;
  const rawDamage = Math.max(1, Math.round(maxHp * 0.1));

  return [{
    type: 'DAMAGE',
    entityId: event.entityId,
    sourceEntityId: null,
    damage: rawDamage,
    tags: ['damage.magical.fire'],
  }];
};
