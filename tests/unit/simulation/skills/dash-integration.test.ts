import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import type { AbilityTemplate } from '../../../../src/content/schemas';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 4,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('dash integration', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['dash', mockAbility('dash', { cooldown: 0, apCost: 1 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('player can act after dash on empty path', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const dashResult = sim.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'dash', targets: [{ x: 6, y: 5 }] });
    expect(dashResult.success).toBe(true);
    expect(sim.getState().player.x).toBe(7);
    expect(sim.getState().player.y).toBe(5);

    // После dash у игрока ещё 1 AP — он может сходить.
    const moveResult = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(moveResult.success).toBe(true);
    expect(sim.getState().player.x).toBe(8);
    expect(sim.getState().player.y).toBe(5);
  });

  it('turn ends when dash consumes last AP and next turn player can act', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 1,
      ap: 1,
      abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const dashResult = sim.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'dash', targets: [{ x: 6, y: 5 }] });
    expect(dashResult.success).toBe(true);
    // Dash исчерпал AP, запустился ход окружения, AP восстановились.
    expect(sim.getState().player.ap).toBe(1);

    const moveResult = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(moveResult.success).toBe(true);
    expect(sim.getState().player.x).toBe(8);
    expect(sim.getState().player.y).toBe(5);
  });
});
