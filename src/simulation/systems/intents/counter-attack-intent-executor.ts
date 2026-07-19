import {GameState} from '@simulation/types';
import {CounterAttackIntent, IntentExecutor} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {findEntity} from '@simulation/state';
import {getEffectiveWeaponDamage} from '@simulation/systems/stats/effective-stats';
import {getPrimaryDamageTag, getWeaponTags} from '@simulation/systems/tags/weapon-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';

/**
 * Исполнитель интента контратаки.
 *
 * Рассчитывает урон от оружия контратакующего и создаёт событие
 * COUNTER_ATTACK_APPLIED. Контентные правила затем превращают это событие
 * в реальный урон по первоначальному атакующему.
 * Если контратакующий или цель мертвы/отсутствуют, событие не создаётся.
 */
export const executeCounterAttackIntent: IntentExecutor<CounterAttackIntent> = (
  state: GameState,
  intent: CounterAttackIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const counterAttacker = findEntity(state, intent.counterAttackerId);
  if (!counterAttacker || !('hp' in counterAttacker) || counterAttacker.hp <= 0 || !counterAttacker.isAlive) {
    return null;
  }

  const target = findEntity(state, intent.targetId);
  if (!target || !('hp' in target) || target.hp <= 0 || !target.isAlive) {
    return null;
  }

  if (!('x' in counterAttacker) || !('y' in counterAttacker) || !('x' in target) || !('y' in target)) {
    return null;
  }

  const dx = target.x - counterAttacker.x;
  const dy = target.y - counterAttacker.y;
  const damage = getEffectiveWeaponDamage(counterAttacker);
  const primaryTag = getPrimaryDamageTag(counterAttacker);
  const tags = mergeDamageIntentTags([primaryTag], getWeaponTags(counterAttacker), ['reaction.counter']);

  return builder.addChild(parent, {
    type: 'COUNTER_ATTACK_APPLIED',
    attackerId: counterAttacker.id,
    targetId: target.id,
    dx,
    dy,
    damage,
    tags,
  });
};
