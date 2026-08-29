/**
 * Интеграционный сценарий: статус «Глухая оборона» (bulwark) первого босса.
 *
 * Проверяет сквозную семантику на реальном контенте:
 * - иммунитет к прямому урону (атака), AoE (DAMAGE_TILE), тику горения
 *   и урону столкновения — с эмитом ENTITY_DAMAGED с damage 0;
 * - статусы на носителя накладываются как обычно (dazed от дробящего оружия);
 * - толчки (PUSH) не сдвигают носителя;
 * - MOVE/ATTACK/USE_ABILITY под Обороной отклоняются, END_TURN разрешён;
 * - подготовленный скилл Обороной не сбрасывается (отличие от stunned).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { createStartingEquipment } from '../../../src/simulation/systems/starting-equipment';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { EnemyEntity, GameState, PlayerEntity } from '../../../src/simulation/types';
import { loadTestContent, registerLegacyTemplates, setupCombatScenario } from './helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import { extractEvents } from '../../../src/presentation/logBuilder';
import { rngChance } from '../../../src/utils/rng';
import { catGuardianMaul } from '../../../src/content/templates/legacy/items/weapons/cat-guardian-maul';
import { modBluntDaze } from '../../../src/content/templates/legacy/modifiers/mod-blunt-daze';

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

/** Босс под «Глухой обороной». Длительность по умолчанию — 3, чтобы пережить тики сценария. */
function createBulwarkedBoss(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
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
    statusEffects: [{ type: 'bulwark', duration: 3, value: 0, statModifiers: null }],
    ...overrides,
  });
}

function withAllVisible(state: GameState): GameState {
  for (const row of state.visible) row.fill(true);
  return state;
}

function createSim(state: GameState, player: PlayerEntity): GameSimulation {
  state.player = player;
  state.entities.set(player.id, player);
  const sim = GameSimulation.loadSavedGame(state);
  sim.initializeTestTurnState('player', player.id);
  return sim;
}

describe('Bulwark scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    loadTestContent();
    // Булава стражника и её модификатор архивированы — регистрируем из legacy.
    registerLegacyTemplates({ items: [catGuardianMaul], modifiers: [modBluntDaze] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('прямой урон обнуляется, но dazed от дробящего оружия накладывается', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);
    createStartingEquipment(state, player, ['cat_guardian_maul']);
    const boss = createBulwarkedBoss();
    state.entities.set(boss.id, boss);
    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    expect(boss.hp).toBe(90);
    const damaged = extractEvents(result).filter((e) => e.type === 'ENTITY_DAMAGED' && e.targetId === boss.id);
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged.every((e) => e.type === 'ENTITY_DAMAGED' && e.damage === 0)).toBe(true);
    // Статусы накладываются как обычно — контрплей срыва подготовки сохраняется.
    expect(boss.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
  });

  it('урон по площади (DAMAGE_TILE от fireball) обнуляется', () => {
    const state = withAllVisible(makeGameState({ map: makeTestMap() }));
    const player = createPlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const boss = createBulwarkedBoss({ x: 7, y: 5 });
    state.entities.set(boss.id, boss);
    const sim = createSim(state, player);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'fireball',
      targets: [{ x: 7, y: 5 }],
    });
    expect(result.success).toBe(true);

    expect(boss.hp).toBe(90);
    const damaged = extractEvents(result).filter((e) => e.type === 'ENTITY_DAMAGED' && e.targetId === boss.id);
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged.every((e) => e.type === 'ENTITY_DAMAGED' && e.damage === 0)).toBe(true);
  });

  it('тик горения обнуляется, длительности статусов тикают как обычно', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({
      statusEffects: [
        { type: 'burning', duration: 2, value: 0, statModifiers: null },
        { type: 'bulwark', duration: 3, value: 0, statModifiers: null },
      ],
    });
    const sim = createSim(state, player);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    // Горение (10% maxHp, min 1) обнулено Обороной.
    expect(player.hp).toBe(100);
    // Оба статуса протикали на 1 — Оборона не блокирует тики длительности.
    expect(player.statusEffects.find((s) => s.type === 'burning')?.duration).toBe(1);
    expect(player.statusEffects.find((s) => s.type === 'bulwark')?.duration).toBe(2);
  });

  it('толчок (dash) не сдвигает носителя и не даёт столкновения', () => {
    const state = makeGameState({ map: makeTestMap() });
    state.map.tiles[5]![8] = 'wall';
    const player = createPlayer({
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const boss = createBulwarkedBoss({ x: 7, y: 5 });
    state.entities.set(boss.id, boss);
    const sim = createSim(state, player);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });
    expect(result.success).toBe(true);

    expect(boss.x).toBe(7);
    expect(boss.y).toBe(5);
    expect(boss.hp).toBe(90);
    expect(boss.statusEffects.some((s) => s.type === 'dazed')).toBe(false);
    expect(extractEvents(result).some((e) => e.type === 'ENTITY_COLLIDED')).toBe(false);
  });

  it('столкновение другого актора с носителем: толкаемый получает урон, носитель — нет', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer({
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const rat = makeEnemy({
      id: 'rat_7_5',
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
    const boss = createBulwarkedBoss({ x: 8, y: 5 });
    state.entities.set(rat.id, rat);
    state.entities.set(boss.id, boss);
    const sim = createSim(state, player);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });
    expect(result.success).toBe(true);

    // Крыса воткнулась в неподвижного носителя Обороны и получила урон столкновения.
    expect(rat.hp).toBeLessThan(40);
    // Носитель не сдвинулся и не получил урон столкновения.
    expect(boss.x).toBe(8);
    expect(boss.hp).toBe(90);
  });

  it('под Обороной MOVE/ATTACK/USE_ABILITY отклоняются, END_TURN разрешён', () => {
    const state = withAllVisible(makeGameState({ map: makeTestMap() }));
    const player = createPlayer({
      statusEffects: [{ type: 'bulwark', duration: 1, value: 0, statModifiers: null }],
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const boss = createBulwarkedBoss();
    state.entities.set(boss.id, boss);
    const sim = createSim(state, player);

    const move = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(move.success).toBe(false);
    expect(extractEvents(move).some((e) => e.type === 'ACTION_REJECTED')).toBe(true);

    const attack = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(attack.success).toBe(false);

    const cast = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'fireball',
      targets: [{ x: 7, y: 5 }],
    });
    expect(cast.success).toBe(false);

    // Оборона не пропускает ход за актора: явный END_TURN проходит, AP не сгорают принудительно.
    expect(player.ap).toBe(3);
    const end = sim.dispatch({ type: 'END_TURN', entityId: player.id });
    expect(end.success).toBe(true);
  });

  it('подготовленный скилл Обороной не сбрасывается', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    const boss = createBulwarkedBoss();
    boss.aiState.preparedAbility = { abilityId: 'swoop', targets: [{ x: 5, y: 5 }] };
    state.entities.set(boss.id, boss);
    const sim = createSim(state, player);
    (sim as any).turnState = { phase: 'actor-turn', factionId: 'enemies', actorId: boss.id };

    // Исполнение подготовленного скилла под Обороной отклоняется...
    const cast = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: boss.id,
      abilityId: 'swoop',
      targets: [{ x: 5, y: 5 }],
    });
    expect(cast.success).toBe(false);
    // ...но подготовка не сбрасывается (отличие от stunned).
    expect(boss.aiState.preparedAbility).not.toBeNull();

    // END_TURN под Обороной проходит и также не трогает подготовку.
    const end = sim.dispatch({ type: 'END_TURN', entityId: boss.id });
    expect(end.success).toBe(true);
    expect(boss.aiState.preparedAbility).toMatchObject({ abilityId: 'swoop' });
  });
});
