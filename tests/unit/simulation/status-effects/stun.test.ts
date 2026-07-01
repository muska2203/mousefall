import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import type { Entity, EntityId, ExecutionNode, GameEvent } from '../../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../../src/simulation/simulation';
import { getDerivedAIMode } from '../../../../src/simulation/ai/ai-state';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';
import type { AbilityTemplate } from '../../../../src/content/schemas';

function findEvents(node: ExecutionNode, predicate: (event: GameEvent) => boolean): GameEvent[] {
  const result: GameEvent[] = [];
  const walk = (n: ExecutionNode) => {
    if (predicate(n.event)) result.push(n.event);
    n.children.forEach(walk);
  };
  walk(node);
  return result;
}

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
    expect('aiState' in enemyAfter && getDerivedAIMode(enemyAfter)).toBe('idle');
    expect(enemy.ap).toBe(0);
  });

  it('SKIP_STUNNED_TURN порождает корректное дерево событий для игрока', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2, statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }] });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(result.success).toBe(true);

    const root = result.phases[0]!.actions[0]!;
    const ticked = findEvents(root, e => e.type === 'STATUS_TICKED' && e.effectTypes.includes('stunned'));
    const removed = findEvents(root, e => e.type === 'STATUS_REMOVED' && e.effectType === 'stunned');
    const consumed = findEvents(root, e => e.type === 'RESOURCE_CONSUMED' && e.resource === 'ap' && e.remaining === 0);

    expect(ticked.length).toBe(1);
    expect(removed.length).toBe(1);
    expect(consumed.length).toBe(1);
  });

  it('SKIP_STUNNED_TURN порождает корректное дерево событий для врага', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ id: 'enemy_stunned', x: 6, y: 5, hp: 20, maxHp: 20, maxAp: 3, ap: 3, statusEffects: [{ type: 'stunned', duration: 2, value: 0, statModifiers: null }] });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(result.success).toBe(true);

    const envPhase = result.phases.find(p => p.side === 'ENVIRONMENT');
    expect(envPhase).toBeDefined();

    const ticked = envPhase!.actions.flatMap(a => findEvents(a, e => e.type === 'STATUS_TICKED' && e.effectTypes.includes('stunned')));
    const consumed = envPhase!.actions.flatMap(a => findEvents(a, e => e.type === 'RESOURCE_CONSUMED' && e.resource === 'ap' && e.remaining === 0));

    expect(ticked.length).toBe(1);
    expect(consumed.length).toBe(1);
  });

  it('при оглушении врага с подготовленной способностью порождается ABILITY_PREPARED_CANCELLED', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      id: 'enemy_stunned',
      x: 6,
      y: 5,
      hp: 20,
      maxHp: 20,
      statusEffects: [{ type: 'stunned', duration: 1, value: 0, statModifiers: null }],
      aiState: {
        strategy: 'hunter',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 6,
        homeY: 5,
        alertTurns: 0,
        preparedAbility: {
          abilityId: 'dash',
          targets: [{ x: 5, y: 5 }],
        },
      },
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    const envPhase = result.phases.find(p => p.side === 'ENVIRONMENT');
    expect(envPhase).toBeDefined();

    const cancelled = envPhase!.actions.flatMap(a => findEvents(a, e => e.type === 'ABILITY_PREPARED_CANCELLED' && e.abilityId === 'dash'));
    expect(cancelled.length).toBe(1);
  });
});
