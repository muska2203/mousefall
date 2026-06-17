import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { GameSimulation } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import { expectRejected } from '../../helpers/simulation-asserts';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 3,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('canActorAct блокирует действия во время каста', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { castTime: 2, apCost: 2 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('отклоняет MOVE, пока игрок кастует', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 2,
      activeCast: { abilityId: 'fireball', fixedTargets: [{ x: 6, y: 5 }], remainingTurns: 1 },
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(result.success).toBe(false);
    expectRejected(result, 'actor_cannot_act');
  });
});
