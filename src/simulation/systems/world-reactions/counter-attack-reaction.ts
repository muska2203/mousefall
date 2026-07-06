import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { getEffectiveDamageEntries } from '@simulation/systems/stats/effective-stats';
import { Intent } from '@simulation/core-types';

/**
 * Реакция мира: при срабатывании контратаки наносит урон первоначальному атакующему
 * из effective damage оружия контратакующего.
 */
export const counterAttackReaction: WorldReaction = (state, event) => {
  if (event.type !== 'COUNTER_ATTACK_APPLIED') return [];

  const counterAttacker = findEntity(state, event.attackerId);
  const target = findEntity(state, event.targetId);

  if (!counterAttacker || !target) return [];
  if (!('hp' in counterAttacker) || counterAttacker.hp <= 0 || counterAttacker.isAlive === false) return [];
  if (!('hp' in target) || target.hp <= 0 || target.isAlive === false) return [];

  const intents: Intent[] = [];
  for (const entry of getEffectiveDamageEntries(counterAttacker)) {
    intents.push({
      type: 'DAMAGE',
      entityId: target.id,
      sourceEntityId: counterAttacker.id,
      damage: entry.damage,
      damageType: entry.damageType,
    });
  }

  return intents;
};
