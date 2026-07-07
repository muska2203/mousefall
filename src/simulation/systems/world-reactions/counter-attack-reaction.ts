import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { getEffectiveDamageEntries } from '@simulation/systems/stats/effective-stats';
import { Intent } from '@simulation/core-types';
import { hasAllTags } from '@simulation/systems/tags/tag-helpers';
import { randomChance } from '@utils/random';

/**
 * Теги, которые должен иметь входящий урон, чтобы спровоцировать контратаку.
 */
const COUNTER_TRIGGER_TAGS = [
  'attack.melee',
  'target.single',
  'delivery.weapon',
] as const;

/**
 * Реакция мира: контратака срабатывает на подходящий входящий урон,
 * а также наносит урон при применении эффекта контратаки.
 */
export const counterAttackReaction: WorldReaction = (state, event) => {
  if (event.type === 'ENTITY_DAMAGED') {
    const target = findEntity(state, event.targetId);
    if (!target) return [];
    if (!('hp' in target) || target.hp <= 0 || target.isAlive === false) return [];
    if (!('statusEffects' in target) || !target.statusEffects.some(e => e.type === 'counterattack')) {
      return [];
    }

    if (!hasAllTags(event.tags, COUNTER_TRIGGER_TAGS)) return [];

    if (!event.sourceEntityId) return [];
    const source = findEntity(state, event.sourceEntityId);
    if (!source) return [];
    if (!('x' in source) || !('y' in source)) return [];

    // Источник должен находиться на соседней клетке (расстояние Чебышёва ≤ 1).
    if (Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y)) > 1) {
      return [];
    }

    if (!randomChance(50)) return [];

    return [{
      type: 'COUNTER_ATTACK',
      counterAttackerId: target.id,
      targetId: event.sourceEntityId,
      dx: source.x - target.x,
      dy: source.y - target.y,
    }];
  }

  if (event.type === 'COUNTER_ATTACK_APPLIED') {
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
        tags: ['reaction.counter'],
      });
    }

    return intents;
  }

  return [];
};
