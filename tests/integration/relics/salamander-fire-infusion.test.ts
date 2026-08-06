/**
 * Интеграционный сценарий: реликвия «Уголёк из-за плиты» (roadmap 0.6).
 *
 * Проверяет сквозную цепочку:
 * 1. Реликвия выдана игроку (GRANT_RELIC), правило зарегистрировано в activeRules.
 * 2. Удар физическим оружием по врагу на клетке с маслом получает тег
 *    `damage.magical.fire` (modifyDamage + addTags).
 * 3. Мировое правило `fire_damage_ignites_oil` поджигает масло под целью.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {executeGrantRelicIntent} from '../../../src/simulation/systems/intents/grant-relic-intent-executor';
import {createStartingEquipment} from '../../../src/simulation/systems/starting-equipment';
import {makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import type {GameState} from '../../../src/simulation/types';
import {loadTestContent, setupCombatScenario} from '../combat-scenarios/helpers';

function getOilAt(state: GameState, x: number, y: number) {
  return state.tileEffects[y]?.[x]?.['cover'];
}

describe('relic_salamander_heart — огненный урон оружия поджигает масло', () => {
  beforeEach(() => {
    setupCombatScenario();
    loadTestContent();
  });

  afterEach(() => {
    // Реестр контента сбрасывается внутри loadTestContent через resetRegistry().
  });

  it('удар оружия по врагу на масле получает fire-тег и поджигает масло', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({
      x: 5, y: 5,
      hp: 100, maxHp: 100,
      ap: 3, maxAp: 3,
      baseStats: { str: 4, dex: 2, int: 0, vit: 4 },
    });
    state.player = player;
    state.entities.set(player.id, player);

    // Физическое оружие — без огненного тега изначально.
    createStartingEquipment(state, player, ['common_splinter_blade']);

    // Выдаём реликвию напрямую через интент (алтарный путь покрыт тестами фазы 0.5).
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: { type: 'END_TURN', entityId: 'any' },
    });
    executeGrantRelicIntent(
      state,
      { type: 'GRANT_RELIC', entityId: player.id, templateId: 'relic_salamander_heart' },
      builder,
      builder.root,
    );
    expect(player.relics).toHaveLength(1);
    expect(player.relics[0]!.templateId).toBe('relic_salamander_heart');

    const rat = makeEnemy({
      id: 'rat_6_5',
      templateId: 'cat_small',
      x: 6, y: 5,
      hp: 50, maxHp: 50,
      baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    });
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);
    sim.setDebugEnabled(true);
    sim.setContentRulesEnabled(true);

    // Масло под врагом.
    const spawnResult = sim.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'oil',
      position: { x: 6, y: 5 },
    });
    expect(spawnResult.success).toBe(true);
    expect(getOilAt(state, 6, 5)?.statusEffects).toHaveLength(0);

    // Удар оружием: правило реликвии добавляет damage.magical.fire к урону.
    const attackResult = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(attackResult.success).toBe(true);
    expect(rat.hp).toBeLessThan(rat.maxHp);

    // Масло подожжено огненным тегом урона.
    expect(getOilAt(state, 6, 5)?.statusEffects.some((s) => s.type === 'burning')).toBe(true);
  });
});
