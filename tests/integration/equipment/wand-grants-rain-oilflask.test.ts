/**
 * Интеграционный тест выдачи способностей через стартовый посох.
 *
 * Проверяет, что экипировка `common_school_wand` выдаёт игроку
 * способности `rain` и `oil_flask` с источником `equipment`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import { loadTestContent, setupCombatScenario } from '../combat-scenarios/helpers';
import { defaultTestMapParams } from '../../fixtures/gameState';

describe('common_school_wand выдаёт rain и oil_flask', () => {
  beforeEach(async () => {
    setupCombatScenario();
    await loadTestContent();
  });

  it('player.abilities содержит rain и oil_flask с source === equipment', () => {
    const config = {
      templateId: 'witcher',
      attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1 },
      startingEquipment: ['common_school_wand'],
    };

    const simulation = GameSimulation.createNewGame(42, config, defaultTestMapParams);
    const state = simulation.getState();

    const rainAbility = state.player.abilities.find((a) => a.templateId === 'rain');
    const oilFlaskAbility = state.player.abilities.find((a) => a.templateId === 'oil_flask');

    expect(rainAbility).toBeDefined();
    expect(rainAbility!.source).toBe('equipment');
    expect(oilFlaskAbility).toBeDefined();
    expect(oilFlaskAbility!.source).toBe('equipment');
  });
});
