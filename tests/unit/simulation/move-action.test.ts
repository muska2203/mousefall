import {describe, expect, it} from "vitest";
import {
    makeEnemy, makeFloorItemContainer,
    makeGameState,
    makePlayer,
    makeStateWithEnemy, makeStateWithEntity,
    makeStateWithPlayer, makeStateWithPlayerAndEntity
} from "../../fixtures/gameState.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";

describe('moveEntity — player movement', () => {
    it('moves player to an empty floor tile', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayer(player);


        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 1});
        const intents = moveEntity.resolve(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 1});

        expect(validationResult.ok).toBe(true);
        expect(intents.length).toBe(1);
        expect(intents[0]).toBeDefined();
        const intent = intents[0];
        if (intent !== undefined && intent.type === 'MOVE') {
            expect(intent.entityId).toEqual(player.id);
            expect(intent.dx).toEqual(1);
            expect(intent.dy).toEqual(1);
        }
    });

    it('does not move into a wall', () => {
        // Игрок в (1,1), стена в (0,1) (граница)
        const player = makePlayer({ x: 1, y: 1 });
        const state = makeStateWithPlayer(player);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: player.id, dx: -1, dy: 0});

        expect(validationResult.ok).toBe(false);
    });

    it('does not move out of bounds', () => {
        const player = makePlayer({ x: 1, y: 1 });
        const state = makeStateWithPlayer(player);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: player.id, dx: 0, dy: -1});

        expect(validationResult.ok).toBe(false);
    });

    it('does not move into not movable entity', () => {
        const player = makePlayer({ x: 1, y: 1 });
        const entity = makeEnemy({ x: 2, y: 1 });
        const state = makeStateWithPlayerAndEntity(player, entity);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 0});

        expect(validationResult.ok).toBe(false);
    });

    it('does move into movable entity', () => {
        const player = makePlayer({ x: 1, y: 1 });
        const entity = makeFloorItemContainer({ x: 2, y: 1 });
        const state = makeStateWithPlayerAndEntity(player, entity);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 0});

        expect(validationResult.ok).toBe(true);
    });
});

describe('moveEntity — enemy movement', () => {
    it('moves enemy to an empty floor tile', () => {
        const entity = makeEnemy({ x: 3, y: 3 });
        const state = makeStateWithEntity(entity);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: entity.id, dx: 1, dy: 0});
        const intents = moveEntity.resolve(state, {type: 'MOVE', entityId: entity.id, dx: 1, dy: 0});

        expect(validationResult.ok).toBe(true);
        expect(intents.length).toBe(1);
        expect(intents[0]).toBeDefined();
        const intent = intents[0];
        if (intent !== undefined && intent.type === 'MOVE') {
            expect(intent.entityId).toEqual(entity.id);
            expect(intent.dx).toEqual(1);
            expect(intent.dy).toEqual(0);
        }
    });

    it('does not move enemy into a wall', () => {
        const entity = makeEnemy({ x: 1, y: 1 });
        const state = makeStateWithEntity(entity);

        const validationResult = moveEntity.validate(state, {type: 'MOVE', entityId: entity.id, dx: -1, dy: 0});

        expect(validationResult.ok).toBe(false);
    });
});