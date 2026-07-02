import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ItemTemplate } from '../../../src/content/schemas';
import { executeSpawnItemIntent } from '../../../src/simulation/systems/intents/spawn-item-intent-executor';
import { makeGameState, makePlayer, makeStateWithPlayerAndEntity } from '../../fixtures/gameState';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { initRegistry, resetRegistry } from '../../../src/content/registry';

function makeBuilder() {
    return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'WAIT', entityId: 'any' } });
}

function makeTestItemTemplate(id: string): ItemTemplate {
    return {
        id,
        type: 'consumable',
        stackable: false,
        maxStack: 1,
        value: 0,
        rarity: 'common',
        equipModifiers: [],
        abilityPool: [],
        grantedAbilities: [],
        apCost: 1,
    };
}

describe('executeSpawnItemIntent', () => {
    beforeEach(() => {
        resetRegistry();
        initRegistry({
            entities: new Map(),
            players: new Map(),
            items: new Map([['test_item', makeTestItemTemplate('test_item')]]),
            abilities: new Map(),
            maps: new Map(),
            doors: new Map(),
            stairs: new Map(),
        });
    });

    afterEach(() => {
        resetRegistry();
    });

    it('создаёт FloorItemContainerEntity и добавляет в state.entities', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 8, y: 8, id: 'enemy_1', type: 'enemy' } as any));
        const builder = makeBuilder();

        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'test_item',
            position: { x: 5, y: 5 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).not.toBeNull();
        const containerId = node!.event.type === 'ITEM_DROPPED' ? node!.event.containerId : null;
        expect(containerId).not.toBeNull();
        expect(state.entities.has(containerId!)).toBe(true);

        const container = state.entities.get(containerId!)!;
        expect(container.type).toBe('floor_item_container');
        expect(container.templateId).toBe('test_item');
        expect(container.displayName).toBe('test_item');
        expect((container as import('../../../src/simulation/types').FloorItemContainerEntity).item.quantity).toBe(1);
    });

    it('использует findFreeTileNear для занятой клетки', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 8, y: 8, id: 'enemy_1', type: 'enemy' } as any));
        const builder = makeBuilder();

        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'test_item',
            position: { x: 5, y: 5 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).not.toBeNull();
        const event = node!.event;
        expect(event.type).toBe('ITEM_DROPPED');
        if (event.type === 'ITEM_DROPPED') {
            // (5,5) занята игроком, ближайшая свободная — (4,5)
            expect(event.position).toEqual({ x: 4, y: 5 });
        }
    });

    it('порождает ITEM_DROPPED с правильными полями', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 8, y: 8, id: 'enemy_1', type: 'enemy' } as any));
        const builder = makeBuilder();

        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'test_item',
            position: { x: 7, y: 7 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).not.toBeNull();
        const event = node!.event;
        expect(event.type).toBe('ITEM_DROPPED');
        if (event.type === 'ITEM_DROPPED') {
            expect(event.dropperEntityId).toBe('enemy_1');
            expect(event.templateId).toBe('test_item');
            expect(event.position).toEqual({ x: 7, y: 7 });
            expect(event.from).toEqual({ x: 7, y: 7 });
            expect(event.containerId).toMatch(/^floor_item_container_/);
        }
    });

    it('возвращает null и не меняет state при невалидном templateId', () => {
        const state = makeGameState();
        const builder = makeBuilder();
        const entityCountBefore = state.entities.size;

        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'nonexistent_item',
            position: { x: 5, y: 5 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).toBeNull();
        expect(state.entities.size).toBe(entityCountBefore);
    });

    it('ITEM_DROPPED содержит itemInstanceId контейнера и containerId сущности на полу', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 8, y: 8, id: 'enemy_1', type: 'enemy' } as any));
        const builder = makeBuilder();

        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'test_item',
            position: { x: 7, y: 7 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).not.toBeNull();
        const event = node!.event;
        expect(event.type).toBe('ITEM_DROPPED');
        if (event.type !== 'ITEM_DROPPED') return;

        const container = state.entities.get(event.containerId);
        expect(container).toBeDefined();
        expect(container!.type).toBe('floor_item_container');

        expect(event.itemInstanceId).toBe((container as import('../../../src/simulation/types').FloorItemContainerEntity).item.instanceId);
        expect(event.containerId).toBe(container!.id);
        expect(event.itemInstanceId).not.toBe(event.containerId);
    });

    it('не спавнит предмет на клетку с другим предметом', () => {
        const player = makePlayer({ x: 5, y: 5 });
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 8, y: 8, id: 'enemy_1', type: 'enemy' } as any));
        // Добавим существующий предмет на (7,7)
        const existingItem = {
            id: 'existing_item',
            type: 'floor_item_container',
            templateId: 'test_item',
            x: 7,
            y: 7,
            blocksMovement: false,
            displayName: 'Существующий',
            interactionKind: 'item',
            item: {
                instanceId: 'existing_item',
                templateId: 'test_item',
                quantity: 1,
                grantedAbilities: [],
            },
        };
        state.entities.set(existingItem.id, existingItem as any);

        const builder = makeBuilder();
        const node = executeSpawnItemIntent(state, {
            type: 'SPAWN_ITEM',
            templateId: 'test_item',
            position: { x: 7, y: 7 },
            sourceEntityId: 'enemy_1',
        }, builder, builder.root);

        expect(node).not.toBeNull();
        const event = node!.event;
        expect(event.type).toBe('ITEM_DROPPED');
        if (event.type === 'ITEM_DROPPED') {
            // (7,7) занят предметом, ближайшая свободная — (6,7)
            expect(event.position).toEqual({ x: 6, y: 7 });
        }
    });
});
