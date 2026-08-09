/**
 * Интеграционный сценарий: детерминированный крит по ослабленной цели.
 *
 * Проверяет:
 * - мировое правило `core_crit_on_dazed_stunned` умножает урон на critMultiplier
 *   атакующего и добавляет тег 'crit' в событие ENTITY_DAMAGED (цель со статусом dazed);
 * - контроль: по цели без статусов урон не меняется и тега 'crit' нет.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { rebuildActiveRules } from '../../../src/simulation/systems/rules/active-rule-lifecycle';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { PlayerEntity, EnemyEntity } from '../../../src/simulation/types';
import type { EntityDamagedEvent, GameEvent } from '../../../src/simulation/core-types';
import { getRegistry } from '../../../src/content/registry';
import type { ItemTemplate } from '../../../src/content/schemas';
import { loadTestContent, setupCombatScenario } from './helpers';
import { extractEvents } from '../../../src/presentation/logBuilder';

/** Тестовый клинок с фиксированным рейнжем {6,6}: ролл детерминирован, крит ×1.5 = 9. */
const testBlade = {
  id: 'test_blade',
  type: 'weapon',
  stackable: false,
  maxStack: 1,
  value: 0,
  weapon: {
    damage: { min: 6, max: 6 },
    range: 1,
    damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
    tags: [],
  },
} as unknown as ItemTemplate;

function createPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  // test_blade: рейнж {6,6} -> урон 6; крит (x1.5) = 9.
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
    equippedWeaponId: 'test_blade',
    ...overrides,
  });
}

function createRat(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: `rat_${overrides.x ?? 0}_${overrides.y ?? 0}`,
    templateId: 'cat_small',
    x: 6,
    y: 5,
    hp: 20,
    maxHp: 20,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    ...overrides,
  });
}

function findDamagedEvent(events: GameEvent[], targetId: string): EntityDamagedEvent | undefined {
  return events.find(
    (e): e is EntityDamagedEvent => e.type === 'ENTITY_DAMAGED' && e.targetId === targetId,
  );
}

describe('Crit on dazed/stunned scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
    getRegistry().items.set('test_blade', testBlade);
  });

  it('атака по цели со статусом dazed умножает урон на critMultiplier и добавляет тег crit', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const rat = createRat();
    rat.statusEffects.push({
      type: 'dazed',
      duration: 2,
      value: 0,
      statModifiers: null,
      instanceId: 'dazed_test',
    });
    rebuildActiveRules(rat);
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    const damaged = findDamagedEvent(extractEvents(result), rat.id);
    expect(damaged).toBeDefined();
    // Базовый урон 6 x critMultiplier 1.5 = 9.
    expect(damaged!.damage).toBe(9);
    expect(damaged!.tags).toContain('crit');
    expect(rat.hp).toBe(20 - 9);
  });

  it('атака по цели без статусов не меняет урон и не добавляет тег crit', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const rat = createRat();
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    const damaged = findDamagedEvent(extractEvents(result), rat.id);
    expect(damaged).toBeDefined();
    expect(damaged!.damage).toBe(6);
    expect(damaged!.tags).not.toContain('crit');
    expect(rat.hp).toBe(20 - 6);
  });
});
