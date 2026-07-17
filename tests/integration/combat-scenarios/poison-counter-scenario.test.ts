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
import type { PlayerEntity, EnemyEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { rngChance } from '../../../src/utils/rng';
import { buildPresentationPlan } from '../../../src/presentation/displayState/planner';
import { buildAnimationTree } from '../../../src/presentation/animation';
import { extractEvents } from '../../../src/presentation/logBuilder';
import { resyncDisplayState } from '../../../src/presentation/displayState/sync';
import type { AnimationNode, AnimationPhase } from '../../../src/presentation/types';

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
    hp: 12,
    maxHp: 12,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    equippedWeaponId: 'common_splinter_blade',
    ...overrides,
  });
}

function flattenNodes(phases: AnimationPhase[]): AnimationNode[] {
  const result: AnimationNode[] = [];
  function visit(nodes: AnimationNode[]) {
    for (const node of nodes) {
      result.push(node);
      visit(node.children);
    }
  }
  for (const phase of phases) {
    visit(phase.nodes);
  }
  return result;
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

  it('produces poison and counterattack events, animations and matching DisplayState', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['common_venom_dagger']);

    const rat = createRat({ x: 6, y: 5 });
    rat.statusEffects.push({
      type: 'counterattack',
      duration: 3,
      value: 0,
      statModifiers: null,
      instanceId: 'counter_test',
    });
    rebuildActiveRules(rat);
    state.entities.set(rat.id, rat);

    // Делаем клетку врага видимой.
    state.visible[5]![6] = true;
    state.explored[5]![6] = true;

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    const events = extractEvents(result);
    expect(events.some((e) => e.type === 'STATUS_APPLIED' && (e as any).effect.type === 'poisoned')).toBe(true);
    expect(events.some((e) => e.type === 'COUNTER_ATTACK_APPLIED')).toBe(true);

    const plan = buildPresentationPlan(result, sim.getState());
    expect(plan.length).toBeGreaterThan(0);

    const phases = buildAnimationTree(result, sim.getState());
    const stepTypes = new Set(flattenNodes(phases).map((n) => n.step.type));
    expect(stepTypes.has('ATTACK')).toBe(true);
    expect(stepTypes.has('DAMAGE')).toBe(true);
    expect(stepTypes.has('STATUS_BURST')).toBe(true);

    const displayState = resyncDisplayState(sim.getState());
    const displayRat = displayState.entities.get(rat.id);
    expect(displayRat?.statusEffects?.some((s) => s.type === 'poisoned')).toBe(true);
    expect(displayRat?.hp).toBe(rat.hp);
  });
});
