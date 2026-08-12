/**
 * Интеграционный сценарий: способность первого босса «Удар по земле» (ground_slam).
 *
 * Проверяет сквозную механику на реальном контенте:
 * - каст боссом бьёт всех существ в квадрате 5×5 вокруг него, кроме него самого
 *   (friendly fire по другим врагам);
 * - выжившие получают dazed на 2 хода через контентное правило ground_slam_daze;
 * - кастер не получает ни урона, ни dazed;
 * - зона телеграфа (getAbilityAffectedPositions — данные для buildAIPreparedIntents)
 *   покрывает квадрат 5×5 от актуальной позиции кастера.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { EnemyEntity, GameState, PlayerEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { rebuildActiveRules } from '../../../src/simulation/systems/rules/active-rule-lifecycle';
import { extractEvents } from '../../../src/presentation/logBuilder';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
  rngFloat: vi.fn(() => 0.5),
}));

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

/** Босс со способностью «Удар по земле». */
function createBoss(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: `boss_${overrides.x ?? 6}_${overrides.y ?? 5}`,
    templateId: 'cat_guardian',
    x: 6,
    y: 5,
    hp: 90,
    maxHp: 90,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 1, int: 0, vit: 4 },
    aiSightRadius: 4,
    abilities: [{ templateId: 'ground_slam', source: 'innate', level: 1, currentCooldown: 0 }],
    ...overrides,
  });
}

function createEnemySim(state: GameState, player: PlayerEntity, boss: EnemyEntity): GameSimulation {
  state.player = player;
  state.entities.set(player.id, player);
  state.entities.set(boss.id, boss);
  const sim = GameSimulation.loadSavedGame(state);
  sim.initializeTestTurnState('player', player.id);
  (sim as any).turnState = { phase: 'actor-turn', factionId: 'enemies', actorId: boss.id };
  return sim;
}

describe('Ground Slam scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('удар бьёт игрока в зоне 5×5 и вешает dazed на 2 хода, кастер не затронут', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBoss();
    rebuildActiveRules(boss);
    const sim = createEnemySim(state, player, boss);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: boss.id,
      abilityId: 'ground_slam',
      targets: [{ x: boss.x, y: boss.y }],
    });
    expect(result.success).toBe(true);

    // Игрок получил урон (12 flat дробящего, броня 0) и dazed на 2 хода.
    expect(player.hp).toBe(88);
    expect(player.statusEffects.some((s) => s.type === 'dazed' && s.duration === 2)).toBe(true);

    // Кастер не получил ни урона, ни dazed.
    expect(boss.hp).toBe(90);
    expect(boss.statusEffects.some((s) => s.type === 'dazed')).toBe(false);

    const damaged = extractEvents(result).filter((e) => e.type === 'ENTITY_DAMAGED');
    expect(damaged.some((e) => e.type === 'ENTITY_DAMAGED' && e.targetId === boss.id)).toBe(false);
  });

  it('friendly fire: другой враг в зоне получает урон и dazed', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({ x: 1, y: 1 });
    const boss = createBoss();
    const ally = makeEnemy({
      id: 'ally_7_5',
      templateId: 'cat_small',
      x: 7,
      y: 5,
      hp: 40,
      maxHp: 40,
      ap: 2,
      maxAp: 2,
      baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
      aiSightRadius: 4,
    });
    state.entities.set(ally.id, ally);
    rebuildActiveRules(boss);
    const sim = createEnemySim(state, player, boss);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: boss.id,
      abilityId: 'ground_slam',
      targets: [{ x: boss.x, y: boss.y }],
    });
    expect(result.success).toBe(true);

    // Союзный враг в зоне получил урон и dazed; игрок вне зоны — нет.
    expect(ally.hp).toBe(28);
    expect(ally.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
    expect(player.hp).toBe(100);
    expect(player.statusEffects.some((s) => s.type === 'dazed')).toBe(false);
  });

  it('зона телеграфа покрывает квадрат 5×5 от актуальной позиции кастера', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBoss();
    const sim = createEnemySim(state, player, boss);

    // Те же данные, что buildAIPreparedIntents кладёт в AIPreparedIntentViewModel.affectedPositions.
    const affected = sim.getAbilityAffectedPositions(
      'ground_slam',
      boss.id,
      [{ x: boss.x, y: boss.y }],
      { x: boss.x, y: boss.y },
    );

    expect(affected).toHaveLength(25);
    expect(affected.some((p) => p.x === boss.x - 2 && p.y === boss.y - 2)).toBe(true);
    expect(affected.some((p) => p.x === boss.x + 2 && p.y === boss.y + 2)).toBe(true);
    expect(affected.some((p) => p.x === boss.x + 3 && p.y === boss.y)).toBe(false);
  });
});
