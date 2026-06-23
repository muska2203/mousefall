import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import type { Entity, EntityId } from '../../../../src/simulation/types';
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
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('stun: пропуск хода', () => {
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

  it('оглушённый игрок не может двигаться, но может нажать WAIT', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2, statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }] });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const moveResult = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(moveResult.success).toBe(false);

    const waitResult = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(waitResult.success).toBe(true);
    expect(sim.getState().player.statusEffects.some(e => e.type === 'stunned')).toBe(false);
  });

  it('оглушённый враг пропускает ход окружения', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ id: 'enemy_stunned', x: 6, y: 5, hp: 20, maxHp: 20, statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }] });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Игрок завершает ход, запускается ход окружения.
    sim.dispatch({ type: 'WAIT', entityId: 'player' });

    // Враг должен был пропустить ход и сбросить stunned.
    const enemyAfter = sim.getState().entities.get(enemy.id)!;
    expect('statusEffects' in enemyAfter && enemyAfter.statusEffects.some((e: { type: string }) => e.type === 'stunned')).toBe(false);
    expect(enemy.ap).toBe(0);
  });
});
