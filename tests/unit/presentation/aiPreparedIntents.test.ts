/**
 * Tests for AI prepared intents rendering data in GameSession.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import '@i18n/config';
import {GameSession} from '../../../src/presentation/gameSession';
import {makeGameState, makePlayer, makeEnemy} from '../../fixtures/gameState';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import {initSkillRegistry} from '../../../src/simulation/skills/index';
import type {AbilityTemplate} from '../../../src/content/schemas';
import type {Entity, EntityId} from '../../../src/simulation/types';
import {GameSimulation, defaultActionHandlerRegistry} from '../../../src/simulation/simulation';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {id, cooldown: 0, apCost: 1, ...overrides} as AbilityTemplate;
}

beforeEach(() => {
  initSkillRegistry();
});

describe('GameSession AI prepared intents', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', {aiPreparable: true, apCost: 2})],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
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
      maxAp: 1,
      ap: 1,
      abilities: [{templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0}],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    sim.dispatch({type: 'WAIT', entityId: player.id});

    const session = new GameSession();
    session.loadGame(sim.getState());

    const renderInput = session.getViewModel().renderInput;
    expect(renderInput).not.toBeNull();
    expect(renderInput!.aiPreparedIntents.length).toBe(1);

    const aiIntent = renderInput!.aiPreparedIntents[0]!;
    expect(aiIntent.abilityId).toBe('fireball');
    expect(aiIntent.affectedPositions.length).toBeGreaterThan(0);
    expect(aiIntent.intents.length).toBeGreaterThan(0);
    expect(aiIntent.intents.some((i) => i.type === 'DAMAGE')).toBe(true);
  });
});
