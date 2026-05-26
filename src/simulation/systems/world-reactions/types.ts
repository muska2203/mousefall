import {GameEvent, GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode, Intent} from "@simulation/core-types.ts";

/** Реакция мира на игровое событие.
 *
 * Реакция получает событие типа {@link GameEvent} и должна сама выполнить narrowing
 * через проверку `event.type`, если ей нужен конкретный подтип.
 *
 * Возвращает массив интентов, которые должны быть выполнены оркестратором.
 * Это позволяет избежать прямого импорта `executeIntent` в реакциях
 * и разрывает циклическую зависимость модулей.
 */
export type WorldReaction = (
    state: GameState,
    event: GameEvent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => Intent[];
