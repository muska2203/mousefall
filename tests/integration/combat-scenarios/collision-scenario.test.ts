/**
 * Интеграционный сценарий: отталкивание в стену / другое существо.
 *
 * Проверяет:
 * - мировые правила `collision_damage` и `collision_daze` срабатывают при push в стену;
 * - мировые правила `collision_damage_actor` / `collision_daze_actor` срабатывают при push в актора;
 * - игрок побеждает и не умирает за один ход.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { PlayerEntity, EnemyEntity, Entity, EntityId, GameState } from '../../../src/simulation/types';
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
    abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
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

function withWallAt(state: GameState, x: number, y: number): GameState {
  state.map.tiles[y]![x] = 'wall';
  return state;
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

describe('Collision scenario', () => {
  beforeEach(async () => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    await loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('dash pushes an enemy into a wall and applies collision damage + daze', () => {
    const state = withWallAt(makeGameState({ map: makeTestMap() }), 8, 5);
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const rat = createRat({ x: 7, y: 5 });
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const playerHpStart = player.hp;

    sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });

    // Враг получил урон от dash + урон от столкновения и оглушение.
    expect(rat.hp).toBeLessThan(15);
    expect(rat.statusEffects.some((s) => s.type === 'dazed')).toBe(true);

    // Добиваем врага обычными атаками.
    let steps = 0;
    while (rat.isAlive && state.phase === 'playing' && steps < 100) {
      if (sim.isPlayerTurn()) {
        const dx = rat.x - player.x;
        const dy = rat.y - player.y;
        if (Math.abs(dx) + Math.abs(dy) === 1 && player.ap > 0) {
          sim.dispatch({ type: 'ATTACK', entityId: player.id, dx, dy });
        } else if (player.ap > 0) {
          const mx = Math.sign(dx);
          const my = Math.sign(dy);
          sim.dispatch({ type: 'MOVE', entityId: player.id, dx: mx, dy: my });
        }
        sim.dispatch({ type: 'END_TURN', entityId: player.id });
        advanceToPlayerTurn(sim);
      } else {
        sim.step();
      }
      steps++;
    }

    expect(rat.isAlive).toBe(false);
    expect(state.player.hp).toBeGreaterThan(0);
    expect(state.player.hp).toBeLessThanOrEqual(playerHpStart);
    expect(state.phase).toBe('playing');
  });

  it('dash pushes an enemy into another actor and applies collision damage + daze to both', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    const rat1 = createRat({ x: 7, y: 5 });
    const rat2 = createRat({ x: 8, y: 5 });
    state.entities.set(rat1.id, rat1);
    state.entities.set(rat2.id, rat2);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });

    // Первая крыса столкнулась со второй: обе получают урон и daze.
    expect(rat1.hp).toBeLessThan(15);
    expect(rat2.hp).toBeLessThan(15);
    expect(rat1.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
    expect(rat2.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
  });

  it('produces ENTITY_COLLIDED events, TILE_SHAKE/PARTICLE_BURST animations and matching DisplayState', () => {
    const state = withWallAt(makeGameState({ map: makeTestMap() }), 8, 5);
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    // Делаем клетки врага и стены видимыми.
    state.visible[5]![6] = true;
    state.visible[5]![7] = true;
    state.visible[5]![8] = true;

    const rat = createRat({ x: 7, y: 5 });
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });
    expect(result.success).toBe(true);

    const events = extractEvents(result);
    expect(events.some((e) => e.type === 'ENTITY_COLLIDED')).toBe(true);

    const plan = buildPresentationPlan(result, sim.getState());
    expect(plan.length).toBeGreaterThan(0);

    const phases = buildAnimationTree(result, sim.getState());
    const stepTypes = new Set(flattenNodes(phases).map((n) => n.step.type));
    expect(stepTypes.has('TILE_SHAKE')).toBe(true);
    expect(stepTypes.has('PARTICLE_BURST')).toBe(true);
    expect(stepTypes.has('STATUS_BURST')).toBe(true);

    const displayState = resyncDisplayState(sim.getState());
    expect(displayState.entities.get(rat.id)?.hp).toBe(rat.hp);
    expect(displayState.entities.get(rat.id)?.x).toBe(rat.x);
    expect(displayState.entities.get(rat.id)?.y).toBe(rat.y);
  });
});
