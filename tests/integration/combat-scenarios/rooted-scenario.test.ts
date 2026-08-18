/**
 * Интеграционный сценарий: статус «Обездвижен» (rooted).
 *
 * Проверяет сквозную семантику на реальном контенте:
 * - MOVE обездвиженного игрока отклоняется, ATTACK и END_TURN разрешены;
 * - рывок (dash) обездвиженного игрока отклоняется;
 * - внешнее перемещение (PUSH от рывка) сдвигает обездвиженного врага;
 * - одновременное наложение bleeding+rooted одним батчем не теряет статусы
 *   (категории wound/control на реальном контенте);
 * - обездвиженный враг с hunter-AI не перемещается на своём ходу.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { EnemyEntity, GameState, PlayerEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import { extractEvents } from '../../../src/presentation/logBuilder';
import { rngChance } from '../../../src/utils/rng';
import { resolveStatusBatch } from '../../../src/simulation/systems/statuses/status-conflict-resolver';
import type { Intent } from '../../../src/simulation/core-types';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
  rngFloat: vi.fn(() => 0.5),
}));

function rootedEffect(duration = 3) {
  return { type: 'rooted' as const, duration, value: 0, statModifiers: null };
}

function createPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 2, int: 5, vit: 4 },
    ...overrides,
  });
}

function createSim(state: GameState, player: PlayerEntity): GameSimulation {
  state.player = player;
  state.entities.set(player.id, player);
  const sim = GameSimulation.loadSavedGame(state);
  sim.initializeTestTurnState('player', player.id);
  return sim;
}

describe('Rooted scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('под rooted MOVE отклоняется, ATTACK и END_TURN разрешены', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({ statusEffects: [rootedEffect()] });
    const rat = makeEnemy({ id: 'rat_6_5', x: 6, y: 5, hp: 40, maxHp: 40 });
    state.entities.set(rat.id, rat);
    const sim = createSim(state, player);

    const move = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });
    expect(move.success).toBe(false);
    expect(extractEvents(move).some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    // Атака по цели в досягаемости разрешена.
    const attack = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(attack.success).toBe(true);
    expect(rat.hp).toBeLessThan(40);

    const end = sim.dispatch({ type: 'END_TURN', entityId: player.id });
    expect(end.success).toBe(true);
  });

  it('рывок (dash) обездвиженного игрока отклоняется', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({
      statusEffects: [rootedEffect()],
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const sim = createSim(state, player);

    const dash = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });
    expect(dash.success).toBe(false);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });

  it('толчок (dash) сдвигает обездвиженного врага — PUSH не блокируется', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const rat: EnemyEntity = makeEnemy({
      id: 'rat_7_5',
      x: 7,
      y: 5,
      hp: 40,
      maxHp: 40,
      statusEffects: [rootedEffect()],
    });
    state.entities.set(rat.id, rat);
    const sim = createSim(state, player);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });
    expect(result.success).toBe(true);

    // Жертву можно выбить из мышеловки толчком (концепт этажа 1, §2).
    expect(rat.x).toBe(8);
    expect(rat.y).toBe(5);
  });

  it('одновременное наложение bleeding и rooted одним батчем не теряет статусы (категории wound/control)', () => {
    // Сценарий мышеловки из концепта этажа 1 (§2, §4.7): один источник накладывает
    // оба статуса — resolveStatusBatch не должен отбросить один из них.
    const state = makeGameState({ map: makeTestMap() });
    const intents: Intent[] = [
      {
        type: 'APPLY_STATUS',
        entityId: 'enemy_test_1',
        sourceEntityId: null,
        status: { type: 'bleeding', duration: 2, value: 0, statModifiers: null },
      },
      {
        type: 'APPLY_STATUS',
        entityId: 'enemy_test_1',
        sourceEntityId: null,
        status: { type: 'rooted', duration: 2, value: 0, statModifiers: null },
      },
    ];

    const resolved = resolveStatusBatch(state, intents);

    expect(resolved).toHaveLength(2);
  });

  it('обездвиженный враг с hunter-AI не перемещается на своём ходу', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({ x: 5, y: 5 });
    // Враг видит игрока (дистанция 3 ≤ aiSightRadius), но не в соседней клетке.
    const rat = makeEnemy({
      id: 'rat_8_5',
      x: 8,
      y: 5,
      hp: 40,
      maxHp: 40,
      maxAp: 2,
      ap: 2,
      aiSightRadius: 4,
      statusEffects: [rootedEffect()],
    });
    state.entities.set(rat.id, rat);
    const sim = createSim(state, player);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    expect(rat.x).toBe(8);
    expect(rat.y).toBe(5);
    expect(player.hp).toBe(100);
  });
});
