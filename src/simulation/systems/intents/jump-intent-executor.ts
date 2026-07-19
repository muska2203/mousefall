import {GameState} from '@simulation/types';
import {IntentExecutor, JumpIntent} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {emitEntityMoved} from '@simulation/systems/intents/move-intent-executer';

/**
 * Исполняет интент прыжка.
 *
 * Логика совпадает с обычным движением, но событие ENTITY_MOVED помечается
 * movementType: 'jump', чтобы уровень презентации мог воспроизвести
 * специальную анимацию прыжка.
 */
export const executeJumpIntent: IntentExecutor<JumpIntent> = (
  state: GameState,
  intent: JumpIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  return emitEntityMoved(state, intent.entityId, intent.dx, intent.dy, builder, parent, 'jump');
};
