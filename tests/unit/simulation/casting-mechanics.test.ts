import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { GameSimulation } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 3,
    ...overrides,
  } as AbilityTemplate;
}

describe('canActorAct blocks actions while casting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { castTime: 2 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('rejects MOVE when player is casting', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 1,
      activeCast: { abilityId: 'fireball', fixedTargets: [{ x: 6, y: 5 }], remainingTurns: 1 },
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(result.success).toBe(false);
    expect(result.phases[0]!.actions[0]!.children[0]!.event.type).toBe('ACTION_REJECTED');
  });
});
