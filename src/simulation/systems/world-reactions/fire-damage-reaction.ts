import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { hasTag } from '@simulation/systems/tags/tag-helpers';
import { randomChance } from '@utils/random';

/**
 * Реакция мира: огненный урон с шансом 10% вызывает горение на 2 хода
 * или продлевает существующее горение до 2 ходов.
 */
export const fireDamageReaction: WorldReaction = (state, event, _builder, _parent) => {
  if (event.type !== 'ENTITY_DAMAGED') return [];
  if (!hasTag(event.tags, 'damage.magical.fire')) return [];

  if (!randomChance(10)) return [];

  const target = findEntity(state, event.targetId);
  if (!target || !('statusEffects' in target)) return [];

  const holder = target as { statusEffects: Array<{ type: string; duration: number }> };
  const existing = holder.statusEffects.find(e => e.type === 'burning');

  // Горение уже есть и длительность >= 2 — ничего не делаем
  if (existing && existing.duration >= 2) return [];

  return [{
    type: 'APPLY_STATUS',
    entityId: event.targetId,
    status: {
      type: 'burning',
      duration: 2,
      value: 0,
      statModifiers: null,
    },
  }];
};
