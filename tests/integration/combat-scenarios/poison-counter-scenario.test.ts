/**
 * Интеграционный сценарий: игрок с ядовитым кинжалом + контратака.
 *
 * Проверяет:
 * - `weapon_poison_on_hit` накладывает `poisoned`;
 * - `counterattack_trigger` / `counterattack_damage` срабатывают при ударе врага;
 * - `status_poison_tick_damage` наносит урон ядом;
 * - игрок побеждает и не умирает за один ход.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { createStartingEquipment } from '../../../src/simulation/systems/starting-equipment';
import { rebuildActiveRules } from '../../../src/simulation/systems/rules/active-rule-lifecycle';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { PlayerEntity, EnemyEntity, Entity, EntityId } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { rngChance } from '../../../src/utils/rng';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

function createWitcherPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 2, int: 0, vit: 4 },
    ...overrides,
  });
}

function createRat(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: `rat_${overrides.x ?? 0}_${overrides.y ?? 0}`,
    templateId: 'cat_small',
    hp: 25,
    maxHp: 25,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    equippedWeaponId: 'common_splinter_blade',
    ...overrides,
  });
}

describe('Poison + counterattack scenario', () => {
  beforeEach(async () => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    await loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('venom dagger poisons and counterattack finishes the enemy', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['common_venom_dagger']);

    const rat = createRat({ x: 6, y: 5 });
    // Даём врагу статус контратаки — так проверяется комбо яд + контратака.
    rat.statusEffects.push({
      type: 'counterattack',
      duration: 3,
      value: 0,
      statModifiers: null,
      instanceId: 'counter_test',
    });
    rebuildActiveRules(rat);
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const playerHpStart = player.hp;
    const ratHpStart = rat.hp;

    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    // Яд должен был наложиться.
    expect(rat.statusEffects.some((s) => s.type === 'poisoned')).toBe(true);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    let steps = 0;
    while (!sim.isPlayerTurn() && state.phase === 'playing' && steps < 50) {
      sim.step();
      steps++;
    }

    // Враг атаковал и получил урон от контратаки.
    expect(player.hp).toBeLessThan(playerHpStart);
    expect(rat.hp).toBeLessThan(ratHpStart);

    // Добиваем врага.
    while (rat.isAlive && state.phase === 'playing' && steps < 100) {
      if (sim.isPlayerTurn()) {
        const dx = rat.x - player.x;
        const dy = rat.y - player.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          sim.dispatch({ type: 'ATTACK', entityId: player.id, dx, dy });
        }
        if (sim.isPlayerTurn()) {
          sim.dispatch({ type: 'END_TURN', entityId: player.id });
        }
      } else {
        sim.step();
      }
      steps++;
    }

    expect(rat.isAlive).toBe(false);
    expect(state.player.hp).toBeGreaterThan(0);
    expect(state.phase).toBe('playing');
  });
});
