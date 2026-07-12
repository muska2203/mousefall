/**
 * Tests for AI prepared intents rendering data in GameSession.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import '@i18n/config';
import {GameSession} from '../../../src/presentation/gameSession';
import {makeGameState, makePlayer, makeEnemy} from '../../fixtures/gameState';
import {createDefaultAIState} from '../../../src/simulation/ai/ai-state';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import {initSkillRegistry} from '../../../src/simulation/skills/index';
import type {AbilityTemplate} from '../../../src/content/schemas';
import type {Entity, EntityId} from '../../../src/simulation/types';
import {GameSimulation, defaultActionHandlerRegistry} from '../../../src/simulation/simulation';
import {registerSkill} from '../../../src/simulation/skills/skillExecutor';
import {testFireballSkill} from '../../helpers/test-skills';
import {createTestSimulation, advanceToPlayerTurn} from '../../helpers/simulation';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {id, cooldown: 0, apCost: 1, ...overrides} as AbilityTemplate;
}

beforeEach(() => {
  initSkillRegistry();
  registerSkill(testFireballSkill);
});

describe('GameSession AI prepared intents', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['test-fireball', mockAbility('test-fireball', {aiPreparable: true, apCost: 2})],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('builds aiPreparedIntents with execution intents for visible enemies', () => {
    const player = makePlayer({x: 5, y: 5, maxAp: 1, ap: 1});
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      maxAp: 2,
      ap: 2,
      aiStrategyId: 'simple-boss',
      aiState: createDefaultAIState('simple-boss'),
      abilities: [{templateId: 'test-fireball', source: 'innate', level: 1, currentCooldown: 0}],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    // Для отображения подготовленного намерения враг должен быть видим игроку.
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;

    const sim = createTestSimulation(state);
    sim.dispatch({type: 'END_TURN', entityId: player.id});
    // Запускаем ход фракции врагов, чтобы босс подготовил способность.
    advanceToPlayerTurn(sim);

    const session = new GameSession();
    session.loadGame(sim.getState());

    const renderInput = session.getViewModel().renderInput;
    expect(renderInput).not.toBeNull();
    expect(renderInput!.aiPreparedIntents.length).toBe(1);

    const aiIntent = renderInput!.aiPreparedIntents[0]!;
    expect(aiIntent.abilityId).toBe('test-fireball');
    expect(aiIntent.affectedPositions.length).toBeGreaterThan(0);
    expect(aiIntent.intents.length).toBeGreaterThan(0);
    expect(aiIntent.intents.some((i) => i.type === 'DAMAGE')).toBe(true);
  });
});
