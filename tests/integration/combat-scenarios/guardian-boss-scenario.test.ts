/**
 * Интеграционный сценарий: AI-стратегия первого босса (guardian-boss).
 *
 * Проверяет сквозное поведение на реальном контенте через GameSimulation:
 * - переход на стадию 2 по порогу 50% HP: немедленное комбо
 *   «Удар по земле (подготовка) + Глухая оборона (каст)», одноразовость;
 * - подготовка не сбрасывается «Глухой обороной», а срывается оглушением;
 * - Оборона спадает тиком до следующего хода босса — Удар исполняется без неё;
 * - стадия 1: Налёт придерживается без геометрии столкновения.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { EnemyEntity, GameState, PlayerEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import { rebuildActiveRules } from '../../../src/simulation/systems/rules/active-rule-lifecycle';
import { createEnemy } from '../../../src/simulation/systems/map-generation/shared';
import type { ExecutionNode, GameEvent } from '../../../src/simulation/core-types';
import type { SimulationResult } from '../../../src/simulation/types';

/** Обходит дерево исполнения и собирает события по предикату (без фильтра «релевантности игроку»). */
function findEvents(node: ExecutionNode, predicate: (e: GameEvent) => boolean): GameEvent[] {
  const results: GameEvent[] = [];
  if (predicate(node.event)) {
    results.push(node.event);
  }
  for (const child of node.children) {
    results.push(...findEvents(child, predicate));
  }
  return results;
}

function findResultEvents(result: SimulationResult, predicate: (e: GameEvent) => boolean): GameEvent[] {
  return result.phases.flatMap((phase) => phase.actions.flatMap((node) => findEvents(node, predicate)));
}

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

/** Босс со стратегией guardian-boss и полным набором способностей (кулдауны 0). */
function createBoss(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  const x = overrides.x ?? 6;
  const y = overrides.y ?? 5;
  return makeEnemy({
    id: `boss_${x}_${y}`,
    templateId: 'cat_guardian',
    x,
    y,
    hp: 90,
    maxHp: 90,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 1, int: 0, vit: 4 },
    aiStrategyId: 'guardian-boss',
    aiSightRadius: 8,
    abilities: [
      { templateId: 'guardian_swoop', source: 'innate', level: 1, currentCooldown: 0 },
      { templateId: 'ground_slam', source: 'innate', level: 1, currentCooldown: 0 },
      { templateId: 'bulwark', source: 'innate', level: 1, currentCooldown: 0 },
    ],
    aiState: {
      strategy: 'guardian-boss',
      mode: 'idle',
      targetX: null,
      targetY: null,
      homeX: x,
      homeY: y,
      preparedAbility: null,
    },
    ...overrides,
  });
}

function createSim(state: GameState, player: PlayerEntity, boss: EnemyEntity): GameSimulation {
  state.player = player;
  state.entities.set(player.id, player);
  state.entities.set(boss.id, boss);
  // Активные правила из ruleIds способностей (ground_slam_daze) — как при спавне врага.
  rebuildActiveRules(boss);
  const sim = GameSimulation.loadSavedGame(state);
  sim.initializeTestTurnState('enemies', boss.id);
  return sim;
}

describe('Guardian boss scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('переход на стадию 2: комбо «Удар + Оборона» на первом ходу после порога, одноразовость', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBoss({ hp: 40 });
    const sim = createSim(state, player, boss);

    // Ход босса: проверка порога → немедленное комбо вместо обычного хода.
    const combo = sim.step();
    expect(combo.success).toBe(true);

    // Подготовлен Удар по земле на позиции босса, каст Обороны исполнен.
    expect(boss.aiState.bossStage).toBe(2);
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: 'ground_slam',
      targets: [{ x: boss.x, y: boss.y }],
    });
    expect(boss.statusEffects.some((s) => s.type === 'bulwark')).toBe(true);
    expect(boss.abilities.find((a) => a.templateId === 'bulwark')?.currentCooldown).toBe(4);
    const events = findResultEvents(combo, (e) => e.type === 'ABILITY_PREPARED' || e.type === 'ABILITY_USED');
    expect(events.some((e) => e.type === 'ABILITY_PREPARED' && e.abilityId === 'ground_slam')).toBe(true);
    expect(events.some((e) => e.type === 'ABILITY_USED' && e.abilityId === 'bulwark')).toBe(true);

    // Одноразовость: флаг перехода сброшен и не поднимается снова.
    expect(boss.aiState.bossTransitionPending).toBe(false);

    // Под Обороной босс завершает ход — подготовка Обороной не сбрасывается.
    const endTurn = sim.step();
    expect(endTurn.success).toBe(true);
    expect(boss.aiState.preparedAbility).toMatchObject({ abilityId: 'ground_slam' });
    expect(boss.aiState.bossStage).toBe(2);
    expect(boss.aiState.bossTransitionPending).toBe(false);
  });

  it('Оборона спадает до хода босса: Удар исполняется без неё, игрок получает урон и dazed', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBoss({ hp: 40 });
    const sim = createSim(state, player, boss);

    // Ход перехода: комбо + конец хода под Обороной.
    sim.step();
    sim.step();

    // Ход игрока: ничего не делает.
    advanceToPlayerTurn(sim);
    sim.dispatch({ type: 'END_TURN', entityId: player.id });

    // Прокручиваем фазы до исполнения Удара: Оборона (duration 1) должна
    // спасть тиком в сетапе фракции врагов — до хода босса.
    let slamResult: SimulationResult | null = null;
    for (let i = 0; i < 10 && !slamResult; i++) {
      const stepResult = sim.step();
      if (findResultEvents(stepResult, (e) => e.type === 'ABILITY_USED' && e.abilityId === 'ground_slam').length > 0) {
        slamResult = stepResult;
      }
    }
    expect(slamResult).not.toBeNull();
    expect(boss.statusEffects.some((s) => s.type === 'bulwark')).toBe(false);

    // Удар исполнился по игроку в зоне 5×5: урон 12 (blunt, броня 0) и dazed на 2 хода.
    expect(player.hp).toBe(88);
    expect(player.statusEffects.some((s) => s.type === 'dazed' && s.duration === 2)).toBe(true);
    expect(boss.aiState.preparedAbility).toBeNull();
  });

  it('срыв подготовки оглушением под Обороной: подготовка сгорает вместе с Обороной', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBoss({ hp: 40 });
    const sim = createSim(state, player, boss);

    // Ход перехода: комбо (Удар подготовлен, Оборона активна).
    sim.step();
    expect(boss.aiState.preparedAbility).toMatchObject({ abilityId: 'ground_slam' });

    // Ход игрока: оглушение проходит сквозь Оборону (статусы накладываются как обычно).
    boss.statusEffects.push({ type: 'stunned', duration: 1, value: 0, statModifiers: null });

    // Оглушённый босс пропускает ход, подготовка срывается.
    const skipped = sim.step();
    expect(skipped.success).toBe(true);
    expect(boss.aiState.preparedAbility).toBeNull();
    expect(
      findResultEvents(skipped, (e) => e.type === 'ABILITY_PREPARED_CANCELLED' && e.abilityId === 'ground_slam').length,
    ).toBeGreaterThan(0);
  });

  it('стадия 1: без геометрии столкновения Налёт придерживается — обычная атака', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    // Босс вплотную к игроку на открытой карте: столкновение невозможно.
    const boss = createBoss({ x: 4, y: 5, ap: 1 });
    const sim = createSim(state, player, boss);

    const action = sim.step();
    expect(action.success).toBe(true);

    // Конец хода (AP 1), Налёт доступен, но точки со столкновением нет — скилл придержан.
    expect(boss.aiState.preparedAbility).toBeNull();
    expect(findResultEvents(action, (e) => e.type === 'ABILITY_PREPARED').length).toBe(0);
    // Босс атакует в ближнем бою охотничьим поведением.
    expect(player.hp).toBeLessThan(100);
  });
});

describe('cat_guardian из шаблона (ручное размещение)', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('босс из шаблона получает стратегию и способности, бой идёт по стадиям', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);
    // Ручное размещение босса из реального шаблона cat_guardian.
    const boss = createEnemy(state, 'cat_guardian', 6, 5);
    state.entities.set(boss.id, boss);

    // Контент шаблона: стратегия guardian-boss и три способности босса
    // (дополнительные — из grantedAbilities оружия, это допустимо).
    expect(boss.aiStrategyId).toBe('guardian-boss');
    expect(boss.abilities.map((a) => a.templateId)).toEqual(
      expect.arrayContaining(['guardian_swoop', 'ground_slam', 'bulwark']),
    );
    expect(boss.maxHp).toBeGreaterThanOrEqual(90);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('enemies', boss.id);

    // Стадия 1 (HP > 50%): ближний бой без подготовки скиллов.
    const first = sim.step();
    expect(first.success).toBe(true);
    expect(boss.aiState.bossStage).toBeUndefined();
    expect(boss.aiState.preparedAbility).toBeNull();

    // Игрок опускает HP босса ниже порога 50% — переход на ближайшем ходу босса.
    boss.hp = Math.floor(boss.maxHp / 2) - 1;

    const transition = sim.step();
    expect(transition.success).toBe(true);
    expect(boss.aiState.bossStage).toBe(2);
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: 'ground_slam',
      targets: [{ x: boss.x, y: boss.y }],
    });
    expect(boss.statusEffects.some((s) => s.type === 'bulwark')).toBe(true);
  });
});
