import {GameEvent, GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";

/** Реакция мира на игровое событие.
 *
 * Реакция получает событие типа {@link GameEvent} и должна сама выполнить narrowing
 * через проверку `event.type`, если ей нужен конкретный подтип.
 */
export type WorldReaction = (
    state: GameState,
    event: GameEvent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => void;
