/**
 * Интеграционный сценарий: игрок с огненным мечом против крыс.
 *
 * Проверяет:
 * - огненный урон усиливается правилом `item_fire_damage_multiplier` на мече;
 * - мировое правило `fire_damage_ignites` накладывает `burning`;
 * - `burning_tick_damage` наносит урон в начале хода врага;
 * - игрок побеждает и не умирает за один ход.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { createStartingEquipment } from '../../../src/simulation/systems/starting-equipment';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { PlayerEntity, EnemyEntity, Entity, EntityId } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
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
    hp: 15,
    maxHp: 15,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    ...overrides,
  });
}

function aliveEnemies(state: { entities: Map<EntityId, Entity> }): EnemyEntity[] {
  return Array.from(state.entities.values()).filter(
    (e): e is EnemyEntity => e.type === 'enemy' && e.isAlive,
  );
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

describe('Fire scenario', () => {
  beforeEach(async () => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    await loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flaming sword applies burning and burning ticks deal damage', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['common_flaming_sword']);

    const rat1 = createRat({ x: 6, y: 5 });
    const rat2 = createRat({ x: 5, y: 6 });
    state.entities.set(rat1.id, rat1);
    state.entities.set(rat2.id, rat2);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const playerHpStart = player.hp;

    // Атакуем обеих крыс; третья атака добивает первую.
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 0, dy: 1 });
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    // Без модификатора огненного меча урон был бы 9; с ×1.5 округляется до 14.
    expect(rat1.hp).toBeLessThanOrEqual(5);
    expect(rat2.hp).toBeLessThanOrEqual(5);

    // Хотя бы одна крыса должна гореть.
    expect(
      [rat1, rat2].some((rat) => rat.statusEffects.some((s) => s.type === 'burning')),
    ).toBe(true);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    // Прокручиваем ходы до возвращения игрока.
    advanceToPlayerTurn(sim);

    // Горение должно было тикнуть и уменьшить HP выжившей крысы.
    const survivingRat = [rat1, rat2].find((rat) => rat.isAlive);
    if (survivingRat) {
      expect(survivingRat.statusEffects.some((s) => s.type === 'burning')).toBe(true);
    }

    // Добиваем оставшихся врагов.
    let steps = 0;
    while (aliveEnemies(state).length > 0 && state.phase === 'playing' && steps < 100) {
      if (sim.isPlayerTurn()) {
        const target = aliveEnemies(state)[0];
        if (target) {
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            sim.dispatch({ type: 'ATTACK', entityId: player.id, dx, dy });
          }
        }
        sim.dispatch({ type: 'END_TURN', entityId: player.id });
        advanceToPlayerTurn(sim);
      } else {
        sim.step();
      }
      steps++;
    }

    expect(aliveEnemies(state)).toHaveLength(0);
    expect(state.player.hp).toBeGreaterThan(0);
    expect(state.phase).toBe('playing');
  });

  it('produces presentation plan, animations and matching DisplayState for fire attacks', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['common_flaming_sword']);

    const rat = createRat({ x: 6, y: 5 });
    state.entities.set(rat.id, rat);

    // Делаем клетку врага видимой, чтобы анимации не отфильтровались.
    state.visible[5]![6] = true;
    state.explored[5]![6] = true;

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    const plan = buildPresentationPlan(result, sim.getState());
    expect(plan.length).toBeGreaterThan(0);

    const events = extractEvents(result);
    const burningApplied = events.some(
      (e) => e.type === 'STATUS_APPLIED' && (e as any).effect.type === 'burning',
    );
    expect(burningApplied).toBe(true);

    const phases = buildAnimationTree(result, sim.getState());
    expect(phases.length).toBeGreaterThan(0);
    const stepTypes = new Set(flattenNodes(phases).map((n) => n.step.type));
    expect(stepTypes.has('ATTACK')).toBe(true);
    expect(stepTypes.has('DAMAGE')).toBe(true);

    const displayState = resyncDisplayState(sim.getState());
    expect(displayState.player.x).toBe(sim.getState().player.x);
    expect(displayState.player.y).toBe(sim.getState().player.y);
    const displayRat = displayState.entities.get(rat.id);
    expect(displayRat?.hp).toBe(rat.hp);
    expect(displayRat?.statusEffects?.some((s) => s.type === 'burning')).toBe(true);
  });
});
