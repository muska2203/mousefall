import {
    ActionAppliedEvent,
    DoorClosedEvent,
    DoorOpenedEvent,
    EntityAttackedEvent,
    EntityDamagedEvent, EntityDiedEvent, EntityMissedEvent,
    EntityMovedEvent, FloorChangedEvent, FogUpdatedEvent,
    GameState, ItemDroppedEvent, ItemPickedUpEvent, ItemUsedEvent, PlayerDiedEvent, PlayerLeveledUpEvent,
    StatusAppliedEvent, StatusRemovedEvent, StatusTickedEvent, TurnEndedEvent
} from "@simulation/types.ts";
import {WorldReaction} from "@simulation/systems/world-reactions/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {deathReaction} from "@simulation/systems/world-reactions/death-reaction.ts";



const worldReactions: ReactionMap = {
    // TODO: Реализовать реакции на перемещение на предмет / переход на следующий уровень

    // ENTITY_MOVED: [
    //     updateFOVReaction,
    //     triggerTrapReaction,
    // ],

    ENTITY_DAMAGED: [
        deathReaction,
    ],
};

export function runWorldReactions(
    state: GameState,
    builder: ExecutionBuilder,
    executedNode: ExecutionNode,
) {

    const reactions =
        worldReactions[executedNode.event.type] ?? [];

    for (const reaction of reactions) {

        reaction(
            state,
            executedNode.event as any,
            builder,
            executedNode,
        );
    }
}


type GameEventMap = {
    ACTION_APPLIED: ActionAppliedEvent;
    ENTITY_MOVED: EntityMovedEvent;
    ENTITY_ATTACKED: EntityAttackedEvent;
    ENTITY_DAMAGED: EntityDamagedEvent;
    ENTITY_DIED: EntityDiedEvent;
    ENTITY_MISSED: EntityMissedEvent;
    ITEM_PICKED_UP: ItemPickedUpEvent;
    ITEM_DROPPED: ItemDroppedEvent;
    ITEM_USED: ItemUsedEvent;
    DOOR_OPENED: DoorOpenedEvent;
    DOOR_CLOSED: DoorClosedEvent;
    FLOOR_CHANGED: FloorChangedEvent;
    TURN_ENDED: TurnEndedEvent;
    PLAYER_DIED: PlayerDiedEvent;
    PLAYER_LEVELED_UP: PlayerLeveledUpEvent;
    FOG_UPDATED: FogUpdatedEvent;
    STATUS_APPLIED: StatusAppliedEvent;
    STATUS_REMOVED: StatusRemovedEvent;
    STATUS_TICKED: StatusTickedEvent;
};

type ReactionMap = {
    [K in keyof GameEventMap]?: WorldReaction<GameEventMap[K]>[];
};