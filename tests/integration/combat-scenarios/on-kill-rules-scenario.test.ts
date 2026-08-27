/**
 * Интеграционный сценарий: правила «при убийстве» (roadmap-1-floor, п. 1.3).
 *
 * Проверяет сквозную цепочку на синтетических правилах (независимость от
 * балансного контента, принцип из TESTING.md):
 * 1. Убийца прокидывается через DIE-интент в событие ENTITY_DIED
 *    (sourceEntityId) и попадает в RuleContext.
 * 2. Правило владельца с условием eventRole: 'source' срабатывает при
 *    убийстве владельцем: restoreAp с amount (+1 AP, кламп к maxAp) и heal.
 * 3. Правило НЕ срабатывает, когда убийца — другой актор, смерть без
 *    источника (среда) или источник совпадает с жертвой (дот-семантика).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {
    DoorTemplate,
    ItemTemplate,
    ModifierTemplate,
    PlayerTemplate,
} from '../../../src/content/schemas';
import type {ContentRule} from '../../../src/simulation/content-rules/types';
import {defaultTestMapParams, makeEnemy} from '../../fixtures/gameState';
import type {EnemyEntity} from '../../../src/simulation/types';
import {setContentRulesOverride, withContentRules} from '../../fixtures/content-rules';
import {setContentRulesEnabled} from '@simulation/content-rules/feature-flags.ts';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {executeIntent} from '../../../src/simulation/systems/intents/execute-intent';
import type {GameState} from '../../../src/simulation/types';

/** Синтетическое правило: +1 AP при убийстве владельцем. */
const testRestoreApOnKill: ContentRule = {
    id: 'test_restore_ap_on_kill',
    trigger: {event: 'ENTITY_DIED'},
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {type: 'restoreAp', amount: 1},
    target: {type: 'self'},
    priority: 0,
};

/** Синтетическое правило: лечение 5 HP при убийстве владельцем. */
const testHealOnKill: ContentRule = {
    id: 'test_heal_on_kill',
    trigger: {event: 'ENTITY_DIED'},
    conditions: [{type: 'eventRole', role: 'source'}],
    effect: {type: 'heal', amount: 5},
    target: {type: 'self'},
    priority: 0,
};

function mockPlayerTemplate(id: string): PlayerTemplate {
    return {
        id,
        portraitImg: '',
        maxAp: 2,
        baseStats: {str: 1, dex: 1, int: 1, vit: 1},
        isDefault: false,
        innateAbilities: [],
        starterRelicPool: [],
    };
}

function mockKillSword(id: string): ItemTemplate {
    return {
        id,
        type: 'weapon',
        stackable: false,
        maxStack: 1,
        value: 0,
        rarity: 'common',
        abilityPool: [],
        fixedModifiers: ['test_mod_restore_ap_on_kill', 'test_mod_heal_on_kill'],
        grantedAbilities: [],
        apCost: 1,
        weapon: {
            damage: {min: 10, max: 10},
            range: 1,
            minRange: 1,
            damageDistribution: [{damageTag: 'damage.physical.slashing', weight: 1.0}],
            tags: [],
        },
    };
}

function mockRuleModifier(id: string, ruleId: string): ModifierTemplate {
    return {
        id,
        effect: {kind: 'rule', ruleId},
        scaling: {kind: 'none'},
        applicableSubtypes: ['sword'],
        polarity: 'positive',
        poolEligible: false,
        weight: 1,
    };
}

function makeBuilder() {
    return new ExecutionBuilder({
        type: 'ACTION_APPLIED', isFieldEvent: false,
        action: {type: 'END_TURN', entityId: 'any'},
    });
}

function createSimulation() {
    const simulation = GameSimulation.createNewGame(
        42,
        {
            templateId: 'test_hero',
            attributes: {strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1},
            startingEquipment: ['test_kill_sword'],
        },
        defaultTestMapParams,
    );
    setContentRulesEnabled(simulation.getState(), true);
    return simulation;
}

function spawnEnemy(state: GameState, overrides: Partial<EnemyEntity> & { id: string }): EnemyEntity {
    const enemy = makeEnemy({hp: 20, maxHp: 20, ap: 0, maxAp: 2, ...overrides});
    state.entities.set(enemy.id, enemy);
    return enemy;
}

beforeEach(() => {
    resetRegistry();
    initRegistry({
        entities: new Map(),
        players: new Map([['test_hero', mockPlayerTemplate('test_hero')]]),
        items: new Map([['test_kill_sword', mockKillSword('test_kill_sword')]]),
        modifiers: new Map([
            ['test_mod_restore_ap_on_kill', mockRuleModifier('test_mod_restore_ap_on_kill', 'test_restore_ap_on_kill')],
            ['test_mod_heal_on_kill', mockRuleModifier('test_mod_heal_on_kill', 'test_heal_on_kill')],
        ]),
        abilities: new Map(),
        statuses: new Map(),
        tileEffects: new Map(),
        tileEffectStatuses: new Map(),
        maps: new Map(),
        doors: new Map([
            [
                'wooden_door',
                {
                    id: 'wooden_door',
                    maxHp: 30,
                    armor: 2,
                } as DoorTemplate,
            ],
        ]),
        stairs: new Map(),
    });
});

afterEach(() => {
    resetRegistry();
    setContentRulesOverride(null);
});

describe('Правила «при убийстве» (on-kill)', () => {
    it('убийство владельцем: +1 AP и лечение через событие ENTITY_DIED', () => {
        withContentRules([testRestoreApOnKill, testHealOnKill], () => {
            const simulation = createSimulation();
            const state = simulation.getState();
            const player = state.player;

            // Оба правила попали в activeRules игрока через фирменные модификаторы меча.
            expect(player.activeRules.some((rule) => rule.id === 'test_restore_ap_on_kill')).toBe(true);
            expect(player.activeRules.some((rule) => rule.id === 'test_heal_on_kill')).toBe(true);

            player.ap = 1; // ровно на одну атаку
            player.hp = 50;

            const enemy = spawnEnemy(state, {
                id: 'enemy_1',
                x: player.x + 1,
                y: player.y,
                hp: 10, // умирает от одного удара меча (10 урона, броня 0)
            });

            const result = simulation.dispatch({
                type: 'ATTACK',
                entityId: player.id,
                dx: 1,
                dy: 0,
            });
            expect(result.success).toBe(true);

            // Враг убит ударом игрока.
            expect(enemy.isAlive).toBe(false);

            // Порядок в dispatch: реакции (restoreAp +1, кламп к maxAp=2)
            // разрешаются до списания стоимости атаки (1 AP) в конце действия:
            // 1 → min(2, 1+1) = 2 → 2 − 1 = 1. Без правила осталось бы 0.
            expect(player.ap).toBe(1);
            // Лечение при убийстве: 50 + 5.
            expect(player.hp).toBe(55);
        });
    });

    it('restoreAp при убийстве клампится к эффективному maxAp', () => {
        withContentRules([testRestoreApOnKill, testHealOnKill], () => {
            const simulation = createSimulation();
            const state = simulation.getState();
            const player = state.player;

            // Полные AP и HP: правила не должны дать значения выше максимумов.
            player.ap = player.maxAp;
            player.hp = player.maxHp;

            // Прямой интент урона-убийства: без списания AP за действие,
            // которое в dispatch-пути происходит после разрешения реакций.
            const victim = spawnEnemy(state, {id: 'enemy_victim', x: 4, y: 4, hp: 5});
            const builder = makeBuilder();
            executeIntent(
                state,
                {
                    type: 'DAMAGE',
                    entityId: victim.id,
                    sourceEntityId: player.id,
                    damage: 10,
                    tags: ['damage.physical.slashing'],
                },
                builder,
                builder.root,
            );

            expect(victim.isAlive).toBe(false);
            expect(player.ap).toBe(player.maxAp);
            expect(player.hp).toBe(player.maxHp);
        });
    });

    it('не срабатывает при убийстве другим актором', () => {
        withContentRules([testRestoreApOnKill, testHealOnKill], () => {
            const simulation = createSimulation();
            const state = simulation.getState();
            const player = state.player;
            player.ap = 0;
            player.hp = 50;

            const killer = spawnEnemy(state, {id: 'enemy_killer', x: 2, y: 2});
            const victim = spawnEnemy(state, {id: 'enemy_victim', x: 3, y: 2, hp: 5});

            const builder = makeBuilder();
            executeIntent(
                state,
                {
                    type: 'DAMAGE',
                    entityId: victim.id,
                    sourceEntityId: killer.id,
                    damage: 10,
                    tags: ['damage.physical.blunt'],
                },
                builder,
                builder.root,
            );

            expect(victim.isAlive).toBe(false);
            // Убийца — не владелец правил: ни AP, ни лечения.
            expect(player.ap).toBe(0);
            expect(player.hp).toBe(50);
        });
    });

    it('не срабатывает при смерти без источника (среда)', () => {
        withContentRules([testRestoreApOnKill, testHealOnKill], () => {
            const simulation = createSimulation();
            const state = simulation.getState();
            const player = state.player;
            player.ap = 0;
            player.hp = 50;

            const victim = spawnEnemy(state, {id: 'enemy_victim', x: 3, y: 3, hp: 5});

            const builder = makeBuilder();
            executeIntent(
                state,
                {
                    type: 'DAMAGE',
                    entityId: victim.id,
                    sourceEntityId: null,
                    damage: 10,
                    tags: ['damage.magical.fire'],
                },
                builder,
                builder.root,
            );

            expect(victim.isAlive).toBe(false);
            expect(player.ap).toBe(0);
            expect(player.hp).toBe(50);
        });
    });

    it('не срабатывает, когда источник смерти — сама жертва (дот-семантика)', () => {
        withContentRules([testRestoreApOnKill, testHealOnKill], () => {
            const simulation = createSimulation();
            const state = simulation.getState();
            const player = state.player;
            player.ap = 0;
            player.hp = 50;

            const victim = spawnEnemy(state, {id: 'enemy_victim', x: 3, y: 3, hp: 5});

            const builder = makeBuilder();
            executeIntent(
                state,
                {
                    type: 'DAMAGE',
                    entityId: victim.id,
                    // Тики статусов принадлежат жертве — дот-килл не засчитывается посторонним.
                    sourceEntityId: victim.id,
                    damage: 10,
                    tags: ['damage.magical.poison'],
                },
                builder,
                builder.root,
            );

            expect(victim.isAlive).toBe(false);
            expect(player.ap).toBe(0);
            expect(player.hp).toBe(50);
        });
    });
});
