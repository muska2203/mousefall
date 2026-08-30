/**
 * Интеграционный сценарий: способность «Удар по земле» (groundSlam).
 *
 * Проверяет сквозную механику на мок-шаблоне (id сохранён как носитель
 * механики — тег идентичности `skill.ground_slam` генерируется из id —
 * но числа свои, не из src/content):
 * - каст бьёт всех существ в квадрате (2·radius+1)² вокруг кастера, кроме него
 *   самого (friendly fire по другим врагам);
 * - выжившие получают dazed через контентное правило на тег skill.<id>;
 * - кастер не получает ни урона, ни dazed;
 * - зона телеграфа (getAbilityAffectedPositions — данные для buildAIPreparedIntents)
 *   покрывает квадрат от актуальной позиции кастера.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { EnemyEntity, GameState, PlayerEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { rebuildActiveRules } from '../../../src/simulation/systems/rules/active-rule-lifecycle';
import { getRegistry } from '../../../src/content/registry';
import { AbilityTemplateSchema, type AbilityTemplateInput } from '../../../src/content/schemas';
import type { ContentRule } from '../../../src/simulation/content-rules/types';
import { getAllContentRules, setContentRulesOverride } from '../../fixtures/content-rules';
import { extractEvents } from '../../../src/presentation/logBuilder';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
  rngFloat: vi.fn(() => 0.5),
}));

/** Тестовые параметры мок-способности (свои числа, не из реального шаблона). */
const TEST_SLAM_RADIUS = 1;
const TEST_SLAM_DAMAGE = 7;
const TEST_SLAM_DAZE_DURATION = 3;

/** Мок «Удара по земле»: вид groundSlam, зона 3×3, урон 7, dazed через мок-правило. */
const testGroundSlam = {
  id: 'ground_slam',
  kind: 'groundSlam',
  spriteId: 'ground_slam',
  cooldown: 4,
  apCost: 2,
  aiPreparable: true,
  damageTag: 'damage.physical.blunt',
  radius: TEST_SLAM_RADIUS,
  baseDamage: TEST_SLAM_DAMAGE,
  tags: ['delivery.ability', 'attack.melee', 'target.aoe'],
  ruleIds: ['test_ground_slam_daze'],
} satisfies AbilityTemplateInput;

/** Мок-правило оглушения выживших (форма повторяет реальное ground_slam_daze). */
const testGroundSlamDazeRule: ContentRule = {
  id: 'test_ground_slam_daze',
  trigger: { event: 'ENTITY_DAMAGED', tags: ['skill.ground_slam'] },
  // eventRole 'source' обязателен: иначе владелец способности оглушал бы сам себя.
  conditions: [{ type: 'eventRole', role: 'source' }],
  effect: { type: 'applyStatus', statusType: 'dazed', duration: TEST_SLAM_DAZE_DURATION },
  target: { type: 'eventTarget' },
  priority: 0,
};

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

/** Босс со способностью «Удар по земле» (мок-шаблон). */
function createBoss(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: `boss_${overrides.x ?? 6}_${overrides.y ?? 5}`,
    templateId: 'test_boss',
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
    // Мок-способность и мок-правило поверх реестра: механика реальная, числа свои.
    getRegistry().abilities.set(testGroundSlam.id, AbilityTemplateSchema.parse(testGroundSlam));
    setContentRulesOverride([...getAllContentRules(), testGroundSlamDazeRule]);
  });

  afterEach(() => {
    setContentRulesOverride(null);
    vi.clearAllMocks();
  });

  it('удар бьёт игрока в зоне 3×3 и вешает dazed, кастер не затронут', () => {
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

    // Игрок получил урон (7 flat дробящего, броня 0) и dazed на 3 хода.
    expect(player.hp).toBe(100 - TEST_SLAM_DAMAGE);
    expect(player.statusEffects.some((s) => s.type === 'dazed' && s.duration === TEST_SLAM_DAZE_DURATION)).toBe(true);

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
    expect(ally.hp).toBe(40 - TEST_SLAM_DAMAGE);
    expect(ally.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
    expect(player.hp).toBe(100);
    expect(player.statusEffects.some((s) => s.type === 'dazed')).toBe(false);
  });

  it('зона телеграфа покрывает квадрат 3×3 от актуальной позиции кастера', () => {
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

    expect(affected).toHaveLength(9);
    expect(affected.some((p) => p.x === boss.x - 1 && p.y === boss.y - 1)).toBe(true);
    expect(affected.some((p) => p.x === boss.x + 1 && p.y === boss.y + 1)).toBe(true);
    expect(affected.some((p) => p.x === boss.x + 2 && p.y === boss.y)).toBe(false);
  });
});
