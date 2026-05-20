import {EntityId, GameState, Position} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";

export type IntentExecutor<T extends Intent> = (
    state: GameState,
    intent: T,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => ExecutionNode | null;

export type Intent =
    | MoveIntent
    | DamageIntent
    | DieIntent
    // | FOVUpdateIntent
    ;

export type MoveIntent = { type: 'MOVE'; entityId: EntityId; dx: number, dy: number};
export type DamageIntent = { type: 'DAMAGE'; entityId: EntityId, damage: number};
export type DieIntent = { type: 'DIE'; entityId: EntityId; position: Position };
// export type FOVUpdateIntent = { type: 'FOV_UPDATE' };