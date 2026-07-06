import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { postDeathLootReaction } from '../../../src/simulation/systems/world-reactions/post-death-loot-reaction';
import { makeGameState, makePlayer, makeStateWithPlayerAndEntity, makeEnemy } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { EntityTemplate } from '../../../src/content/schemas';

function makeEntityTemplate(partial: Partial<EntityTemplate> = {}): EntityTemplate {
    return {
        id: 'test_enemy',
        health: { max: 10 },
        combat: { damage: 1, armor: 0 },
        baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        equipment: {},
        abilities: [],
        lootTable: [],
        lootDropTable: [{ count: 1, weight: 1 }],
        xpReward: 0,
        renderScale: 1,
        aiSightRadius: 6,
        aiStrategyId: 'hunter',
        maxAp: 1,
        ...partial,
    };
}

describe('postDeathLootReaction', () => {
    beforeEach(() => {
        resetRegistry();
    });

    afterEach(() => {
        resetRegistry();
    });

    it('возвращает [] для врага без lootTable', () => {
        initRegistry({
            entities: new Map([['no_loot_enemy', makeEntityTemplate({ id: 'no_loot_enemy', lootTable: [] })]]),
            players: new Map(),
            items: new Map(),
            abilities: new Map(),
            maps: new Map(),
            doors: new Map(),
            stairs: new Map(),
        });

        const enemy = makeEnemy({ templateId: 'no_loot_enemy' });
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const event = { type: 'ENTITY_DIED' as const, entityId: enemy.id, position: { x: enemy.x, y: enemy.y } };

        const result = postDeathLootReaction(state, event, null as any, null as any);
        expect(result).toEqual([]);
    });

    it('возвращает SpawnItemIntent для врага с lootTable', () => {
        initRegistry({
            entities: new Map([[
                'loot_enemy',
                makeEntityTemplate({
                    id: 'loot_enemy',
                    lootTable: [{ templateId: 'potion', weight: 1 }],
                }),
            ]]),
            players: new Map(),
            items: new Map(),
            abilities: new Map(),
            maps: new Map(),
            doors: new Map(),
            stairs: new Map(),
        });

        const enemy = makeEnemy({ templateId: 'loot_enemy' });
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const event = { type: 'ENTITY_DIED' as const, entityId: enemy.id, position: { x: enemy.x, y: enemy.y } };

        const result = postDeathLootReaction(state, event, null as any, null as any);
        expect(result.length).toBe(1);
        expect(result[0]).toMatchObject({
            type: 'SPAWN_ITEM',
            templateId: 'potion',
            position: { x: enemy.x, y: enemy.y },
            sourceEntityId: enemy.id,
        });
    });

    it('возвращает [] если entity.type !== enemy', () => {
        initRegistry({
            entities: new Map(),
            players: new Map(),
            items: new Map(),
            abilities: new Map(),
            maps: new Map(),
            doors: new Map(),
            stairs: new Map(),
        });

        const player = makePlayer();
        const state = makeStateWithPlayerAndEntity(player, makePlayer({ x: 3, y: 3, id: 'other_player' } as any));
        const event = { type: 'ENTITY_DIED' as const, entityId: 'other_player', position: { x: 3, y: 3 } };

        const result = postDeathLootReaction(state, event, null as any, null as any);
        expect(result).toEqual([]);
    });

    it('рендомит count по весам из lootDropTable', () => {
        initRegistry({
            entities: new Map([[
                'multi_loot_enemy',
                makeEntityTemplate({
                    id: 'multi_loot_enemy',
                    lootTable: [
                        { templateId: 'potion', weight: 1 },
                        { templateId: 'sword', weight: 1 },
                    ],
                    lootDropTable: [
                        { count: 2, weight: 1 },
                        { count: 3, weight: 1 },
                    ],
                }),
            ]]),
            players: new Map(),
            items: new Map(),
            abilities: new Map(),
            maps: new Map(),
            doors: new Map(),
            stairs: new Map(),
        });

        const enemy = makeEnemy({ templateId: 'multi_loot_enemy' });
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const event = { type: 'ENTITY_DIED' as const, entityId: enemy.id, position: { x: enemy.x, y: enemy.y } };

        const result = postDeathLootReaction(state, event, null as any, null as any);
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.length).toBeLessThanOrEqual(3);
        expect(result.every(r => r.type === 'SPAWN_ITEM')).toBe(true);
    });
});
