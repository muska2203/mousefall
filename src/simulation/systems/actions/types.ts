import {EntityId, GameEvent, GameState, ValidationResult} from "@simulation/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export type GameAction =
    | MoveAction
    | AttackAction
    | WaitAction
    | DescendAction
    | AscendAction;

export type MoveAction = {
    type: 'MOVE';
    entityId: EntityId;

    dx: number;
    dy: number;
};

export type AttackAction = {
    type: 'ATTACK';
    entityId: EntityId;

    dx: number;
    dy: number;
};

export type WaitAction = {
    type: 'WAIT';
    entityId: EntityId;
};

export type DescendAction = {
    type: 'DESCEND';
    entityId: EntityId;
};

export type AscendAction = {
    type: 'ASCEND';
    entityId: EntityId;
};

/** Обработчик игрового действия.
 *
 * Хендлер получает `action: GameAction` и должен сам выполнить narrowing
 * через проверку `action.type`, если ему нужен конкретный подтип.
 */
export type ActionHandler = {
    validate(state: GameState, action: GameAction): ValidationResult;

    resolve(state: GameState, action: GameAction): Intent[];

    execute(state: GameState, action: GameAction, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode): void;
}

export type ExecutionNode = {
    event: GameEvent;
    parent: ExecutionNode | null;
    children: ExecutionNode[];
};

export class ExecutionBuilder {
    root: ExecutionNode;
    constructor(event: GameEvent) {
        this.root = {
            event,
            parent: null,
            children: [],
        }
    }

    addChild(
        parent: ExecutionNode,
        event: GameEvent,
    ): ExecutionNode {

        const node = {
            event,
            parent: parent,
            children: [],
        };

        parent.children.push(node);

        return node;
    }
}
