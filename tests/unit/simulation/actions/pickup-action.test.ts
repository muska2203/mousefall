import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {pickupEntity} from '../../../../src/simulation/systems/actions/pickup-action';
import {makeGameState, makePlayer, makeEnemy, makeStateWithPlayerAndEntity, makeFloorItem} from '../../../fixtures/gameState';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

function makeBuilder() {
    return new ExecutionBuilder({type: 'ACTION_APPLIED', action: {type: 'WAIT', entityId: 'any'}});
}

beforeEach(() => {
    resetRegistry();
    initRegistry({
        entities: new Map(),
        players: new Map(),
        items: new Map([
            ['health_potion', { id: 'health_potion', name: 'Зелье здоровья', description: '', symbol: '!', type: 'consumable', stackable: false, maxStack: 1, weight: 1, value: 0, abilityPool: [] } as any],
        ]),
        abilities: new Map(),
        maps: new Map(),
        stairs: new Map(),
    });
});

afterEach(() => {
    resetRegistry();
});

describe('pickupEntity', () => {
    it('успешно поднимает предмет, если он находится на клетке актёра', () => {
        const player = makePlayer({x: 5, y: 5});
        const item = makeFloorItem({x: 5, y: 5, id: 'potion_1', templateId: 'health_potion'});
        const state = makeStateWithPlayerAndEntity(player, item);
        const builder = makeBuilder();

        const validation = pickupEntity.validate(state, {type: 'PICKUP', entityId: player.id});
        expect(validation.ok).toBe(true);

        const intents = pickupEntity.resolve(state, {type: 'PICKUP', entityId: player.id});
        expect(intents.length).toBe(1);
        expect(intents[0]).toMatchObject({
            type: 'PICK_UP',
            entityId: player.id,
            itemId: item.id,
            templateId: item.templateId,
        });

        pickupEntity.execute(state, {type: 'PICKUP', entityId: player.id}, intents, builder, builder.root);
        expect(player.inventory.length).toBe(1);
        expect(state.entities.has(item.id)).toBe(false);
    });

    it('отклоняет действие, если на клетке нет предмета', () => {
        const player = makePlayer({x: 5, y: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy({x: 8, y: 8}));

        const validation = pickupEntity.validate(state, {type: 'PICKUP', entityId: player.id});
        expect(validation.ok).toBe(false);
        expect((validation as any).reasonCode).toBe('no_item_here');
    });

    it('отклоняет действие, если актёр не существует', () => {
        const state = makeGameState();

        const validation = pickupEntity.validate(state, {type: 'PICKUP', entityId: 'ghost'});
        expect(validation.ok).toBe(false);
        expect((validation as any).reasonCode).toBe('entity_not_exists');
    });

    it('возвращает пустой массив интентов при невалидном типе действия', () => {
        const state = makeGameState();
        const intents = pickupEntity.resolve(state, {type: 'WAIT', entityId: 'player'} as any);
        expect(intents).toEqual([]);
    });
});
