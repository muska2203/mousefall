import {GameState} from '@simulation/types';
import {IntentExecutor, TriggerStairExitIntent} from '@simulation/systems/intents/types';
import {ExecutionBuilder, ExecutionNode} from '@simulation/core-types';

/**
 * Исполняет интент TRIGGER_STAIR_EXIT.
 *
 * Этот интент не мутирует игровое состояние, а только порождает
 * событие STAIR_EXIT_TRIGGERED в дереве выполнения. Сам переход между
 * этажами выполняется позже через action DESCEND / ASCEND.
 */
export const executeTriggerStairExitIntent: IntentExecutor<TriggerStairExitIntent> = (
    state: GameState,
    intent: TriggerStairExitIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    return builder.addChild(parent, {
        type: 'STAIR_EXIT_TRIGGERED',
        direction: intent.direction,
    });
};
