import { GameState } from '@simulation/types';
import { CounterAttackIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';

/**
 * Исполнитель интента контратаки.
 *
 * Создаёт событие COUNTER_ATTACK_APPLIED, которое затем обрабатывается
 * world reaction и превращается в реальный урон по первоначальному атакующему.
 * Если контратакующий мёртв или отсутствует, событие не создаётся.
 */
export const executeCounterAttackIntent: IntentExecutor<CounterAttackIntent> = (
  state: GameState,
  intent: CounterAttackIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const counterAttacker = findEntity(state, intent.counterAttackerId);
  if (!counterAttacker || !('hp' in counterAttacker) || counterAttacker.hp <= 0 || counterAttacker.isAlive === false) {
    return null;
  }

  return builder.addChild(parent, {
    type: 'COUNTER_ATTACK_APPLIED',
    attackerId: intent.counterAttackerId,
    targetId: intent.targetId,
    dx: intent.dx,
    dy: intent.dy,
  });
};
