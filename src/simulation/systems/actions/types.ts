import {EntityId, GameEvent, GameState, ValidationResult} from "@simulation/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

export type GameAction =
    | MoveAction
    | AttackAction
    | WaitAction;
// TODO: NextLevelAction — проверяет, стоит ли игрок на клетке выхода, и выполняет спуск.

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
};

export type ActionHandler<T extends GameAction> = {
    validate(state: GameState, action: T): ValidationResult;

    resolve(state: GameState, action: T): Intent[];

    execute(state: GameState, action: T, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode): void;
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