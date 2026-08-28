/**
 * Интеграционный сценарий: weapon_blunt_daze после перевода с chance на «всегда».
 *
 * Проверяет:
 * - цель удара владельца cat_guardian_maul получает dazed всегда (без вероятности);
 * - владелец булавы НЕ получает dazed, когда дробящим уроном бьют его самого
 *   (условие eventRole: 'source' — фикс самодеза, обязательный при «всегда»).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { createStartingEquipment } from '../../../src/simulation/systems/starting-equipment';
import { makeGameState, makePlayer, makeEnemy, makeTestMap } from '../../fixtures/gameState';
import type { PlayerEntity, EnemyEntity } from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { advanceToPlayerTurn } from '../../helpers/simulation';

function createPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
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
    x: 6,
    y: 5,
    hp: 40,
    maxHp: 40,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    // Прямой профиль атаки: дробящий урон с delivery.weapon
    // (сохраняет семантику бывшей безоружной атаки врага).
    attack: {
      damage: { min: 1, max: 1 },
      range: 1,
      minRange: 1,
      damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    },
    ...overrides,
  });
}

describe('Blunt daze scenario', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
  });

  it('удар владельца cat_guardian_maul всегда накладывает dazed на цель', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['cat_guardian_maul']);

    const rat = createRat();
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    expect(rat.statusEffects.some((s) => s.type === 'dazed')).toBe(true);
  });

  it('владелец cat_guardian_maul НЕ получает dazed при ударе по нему дробящим уроном', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['cat_guardian_maul']);

    const rat = createRat();
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const playerHpStart = player.hp;

    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    // Убеждаемся, что крыса реально атаковала (её атака — дробящая).
    expect(player.hp).toBeLessThan(playerHpStart);
    // Правило владельца сработало бы на цель события (самого владельца),
    // если бы не условие eventRole: 'source'.
    expect(player.statusEffects.some((s) => s.type === 'dazed')).toBe(false);
  });
});
