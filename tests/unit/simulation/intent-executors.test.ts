import {describe, expect, it, beforeEach, afterEach} from "vitest";
import {ExecutionBuilder} from "@simulation/systems/actions/types.ts";
import {executeMoveIntent} from "@simulation/systems/intents/move-intent-executer.ts";
import {executeDamageIntent} from "@simulation/systems/intents/attack-intent-executer.ts";
import {executeDieIntent} from "@simulation/systems/intents/die-intent-executer.ts";
import {executePickUpIntent} from "@simulation/systems/intents/pick-up-intent-executor.ts";
import {executeIntent} from "@simulation/systems/intents/execute-intent.ts";
import {makeEnemy, makeGameState, makePlayer, makeStateWithPlayerAndEntity, makeFloorItem} from "../../fixtures/gameState.ts";
import {PLAYER_ID} from "@utils/constants.ts";
import {initRegistry, resetRegistry} from "../../../src/content/registry";

function makeBuilder() {
    return new ExecutionBuilder({type: 'ACTION_APPLIED', action: {type: 'WAIT', entityId: 'any'}});
}

beforeEach(() => {
    resetRegistry();
    initRegistry({
        entities: new Map(),
        players: new Map(),
        items: new Map([
            ['health_potion', { id: 'health_potion', name: 'Зелье здоровья', description: '', type: 'consumable', stackable: false, maxStack: 1, value: 0, abilityPool: [] } as any],
        ]),
        abilities: new Map(),
        maps: new Map(),
        doors: new Map(),
        stairs: new Map(),
    });
});

afterEach(() => {
    resetRegistry();
});

// =========================================================
// executeMoveIntent
// =========================================================
describe('executeMoveIntent', () => {
    it('перемещает сущность на свободную клетку и порождает ENTITY_MOVED', () => {
        const player = makePlayer({x: 5, y: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy({x: 8, y: 8}));
        const builder = makeBuilder();

        const node = executeMoveIntent(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 0}, builder, builder.root);

        expect(player.x).toBe(6);
        expect(player.y).toBe(5);
        expect(node).not.toBeNull();
        expect(node!.event.type).toBe('ENTITY_MOVED');
        expect(node!.event).toMatchObject({
            entityId: player.id,
            from: {x: 5, y: 5},
            to: {x: 6, y: 5},
        });
    });

    it('не перемещает в стену и возвращает null', () => {
        // Карта 10×10 со стенами по периметру; (0,5) — стена
        const player = makePlayer({x: 1, y: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy({x: 8, y: 8}));
        const builder = makeBuilder();

        const node = executeMoveIntent(state, {type: 'MOVE', entityId: player.id, dx: -1, dy: 0}, builder, builder.root);

        expect(player.x).toBe(1);
        expect(player.y).toBe(5);
        expect(node).toBeNull();
    });

    it('не перемещает, если сущность отсутствует в состоянии', () => {
        const state = makeGameState();
        const builder = makeBuilder();

        const node = executeMoveIntent(state, {type: 'MOVE', entityId: 'nonexistent', dx: 1, dy: 0}, builder, builder.root);

        expect(node).toBeNull();
    });
});

// =========================================================
// executeDamageIntent
// =========================================================
describe('executeDamageIntent', () => {
    it('уменьшает HP цели и порождает ENTITY_DAMAGED', () => {
        const enemy = makeEnemy({hp: 20, armor: 0});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        const node = executeDamageIntent(state, {type: 'DAMAGE', entityId: enemy.id, sourceEntityId: null, damage: 5, damageType: 'blunt'}, builder, builder.root);

        expect(enemy.hp).toBe(15);
        expect(node).not.toBeNull();
        expect(node!.event.type).toBe('ENTITY_DAMAGED');
        expect(node!.event).toMatchObject({targetId: enemy.id, damage: 5});
    });

    it('учитывает броню цели', () => {
        const enemy = makeEnemy({hp: 20, statModifiers: [{ stat: 'armor', value: 3, op: 'add', source: 'test' }]});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        executeDamageIntent(state, {type: 'DAMAGE', entityId: enemy.id, sourceEntityId: null, damage: 5, damageType: 'blunt'}, builder, builder.root);

        expect(enemy.hp).toBe(18); // 5 - 3 = 2 урона
    });

    it('минимальный урон равен 1, даже если броня выше урона', () => {
        const enemy = makeEnemy({hp: 20, statModifiers: [{ stat: 'armor', value: 100, op: 'add', source: 'test' }]});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        const node = executeDamageIntent(state, {type: 'DAMAGE', entityId: enemy.id, sourceEntityId: null, damage: 5, damageType: 'blunt'}, builder, builder.root);

        expect(enemy.hp).toBe(19);
        expect(node!.event.type).toBe('ENTITY_DAMAGED');
        if (node!.event.type === 'ENTITY_DAMAGED') {
            expect(node!.event.damage).toBe(1);
        }
    });

    it('возвращает null, если цель не найдена', () => {
        const state = makeGameState();
        const builder = makeBuilder();

        const node = executeDamageIntent(state, {type: 'DAMAGE', entityId: 'ghost', sourceEntityId: null, damage: 10, damageType: 'blunt'}, builder, builder.root);

        expect(node).toBeNull();
    });
});

// =========================================================
// executeDieIntent
// =========================================================
describe('executeDieIntent', () => {
    it('удаляет врага из entities и порождает ENTITY_DIED', () => {
        const enemy = makeEnemy({x: 3, y: 4});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        const node = executeDieIntent(state, {type: 'DIE', entityId: enemy.id, position: {x: 3, y: 4}}, builder, builder.root);

        expect(state.entities.has(enemy.id)).toBe(true);
        expect(enemy.isAlive).toBe(false);
        expect(enemy.blocksMovement).toBe(false);
        expect(node).not.toBeNull();
        expect(node!.event.type).toBe('ENTITY_DIED');
        expect(node!.event).toMatchObject({entityId: enemy.id, position: {x: 3, y: 4}});
    });

    it('переводит игрока в phase dead и порождает PLAYER_DIED', () => {
        const player = makePlayer({hp: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy());
        const builder = makeBuilder();

        const node = executeDieIntent(state, {type: 'DIE', entityId: PLAYER_ID, position: {x: player.x, y: player.y}}, builder, builder.root);

        expect(state.phase).toBe('dead');
        expect(player.hp).toBe(0);
        expect(node).not.toBeNull();
        expect(node!.event.type).toBe('PLAYER_DIED');
    });

    it('возвращает null, если враг уже отсутствует в состоянии', () => {
        const state = makeGameState();
        const builder = makeBuilder();

        const node = executeDieIntent(state, {type: 'DIE', entityId: 'missing', position: {x: 0, y: 0}}, builder, builder.root);

        expect(node).toBeNull();
    });
});

// =========================================================
// executeIntent + world reactions (интеграция)
// =========================================================
describe('executeIntent с мировыми реакциями', () => {
    it('урон, убивающий врага, порождает цепочку ENTITY_DAMAGED → ENTITY_DIED', () => {
        const enemy = makeEnemy({hp: 5, armor: 0});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        executeIntent(state, {type: 'DAMAGE', entityId: enemy.id, sourceEntityId: null, damage: 5, damageType: 'blunt'}, builder, builder.root);

        // Проверяем дерево событий
        expect(builder.root.children.length).toBe(1);
        const damageNode = builder.root.children[0]!;
        expect(damageNode.event.type).toBe('ENTITY_DAMAGED');
        expect(damageNode.children.length).toBe(1);
        expect(damageNode.children[0]).toBeDefined();
        expect(damageNode.children[0]!.event.type).toBe('ENTITY_DIED');

        // Проверяем состояние
        expect(enemy.hp).toBe(0);
        expect(state.entities.has(enemy.id)).toBe(true);
        expect(enemy.isAlive).toBe(false);
        expect(enemy.blocksMovement).toBe(false);
    });

    it('урон, не убивающий врага, не порождает ENTITY_DIED', () => {
        const enemy = makeEnemy({hp: 10, armor: 0});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        const builder = makeBuilder();

        executeIntent(state, {type: 'DAMAGE', entityId: enemy.id, sourceEntityId: null, damage: 3, damageType: 'blunt'}, builder, builder.root);

        expect(builder.root.children.length).toBe(1);
        const damageNode = builder.root.children[0]!;
        expect(damageNode.event.type).toBe('ENTITY_DAMAGED');
        expect(damageNode.children.length).toBe(0);
        expect(state.entities.has(enemy.id)).toBe(true);
        expect(enemy.hp).toBe(7);
    });

    it('перемещение не порождает дополнительных дочерних событий', () => {
        const player = makePlayer({x: 5, y: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy({x: 8, y: 8}));
        const builder = makeBuilder();

        executeIntent(state, {type: 'MOVE', entityId: player.id, dx: 1, dy: 0}, builder, builder.root);

        expect(builder.root.children.length).toBe(1);
        const moveNode = builder.root.children[0]!;
        expect(moveNode.event.type).toBe('ENTITY_MOVED');
        expect(moveNode.children.length).toBe(0);
    });
});

// =========================================================
// executePickUpIntent
// =========================================================
describe('executePickUpIntent', () => {
    it('добавляет предмет в инвентарь игрока и удаляет с пола', () => {
        const player = makePlayer({x: 5, y: 5});
        const item = makeFloorItem({x: 5, y: 5, id: 'potion_1', templateId: 'health_potion'});
        const state = makeStateWithPlayerAndEntity(player, item);
        const builder = makeBuilder();

        const node = executePickUpIntent(state, {
            type: 'PICK_UP',
            entityId: player.id,
            itemId: item.id,
            templateId: item.templateId,
        }, builder, builder.root);

        expect(node).not.toBeNull();
        expect(node!.event.type).toBe('ITEM_PICKED_UP');
        expect(player.inventory.length).toBe(1);
        expect(player.inventory[0]).toMatchObject({
            templateId: item.templateId,
            quantity: 1,
            grantedAbilities: [],
        });
        expect(state.entities.has(item.id)).toBe(false);
    });

    it('возвращает null, если предмет отсутствует', () => {
        const player = makePlayer({x: 5, y: 5});
        const state = makeStateWithPlayerAndEntity(player, makeEnemy({x: 8, y: 8}));
        const builder = makeBuilder();

        const node = executePickUpIntent(state, {
            type: 'PICK_UP',
            entityId: player.id,
            itemId: 'missing_item',
            templateId: 'health_potion',
        }, builder, builder.root);

        expect(node).toBeNull();
    });

    it('возвращает null, если актёр не является игроком', () => {
        const enemy = makeEnemy({x: 5, y: 5});
        const item = makeFloorItem({x: 5, y: 5, id: 'potion_1', templateId: 'health_potion'});
        const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
        state.entities.set(item.id, item);
        const builder = makeBuilder();

        const node = executePickUpIntent(state, {
            type: 'PICK_UP',
            entityId: enemy.id,
            itemId: item.id,
            templateId: item.templateId,
        }, builder, builder.root);

        expect(node).toBeNull();
        expect(state.entities.has(item.id)).toBe(true);
    });
});
