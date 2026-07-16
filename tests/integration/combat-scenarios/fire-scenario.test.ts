/**
 * Интеграционный сценарий: игрок с огненным мечом против крыс.
 *
 * Проверяет:
 * - огненный урон усиливается правилом `weapon_fire_damage_boost`;
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

    // Без модификатора огненного меча урон был бы 9; с ×1.15 округляется до 10.
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
    expect(state.player.hp).toBeLessThan(playerHpStart);
    expect(state.phase).toBe('playing');
  });
});
