import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import type { Entity, EntityId } from '../../../src/simulation/types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate, ItemTemplate } from '../../../src/content/schemas';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import { expectRejected } from '../../helpers/simulation-asserts';

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

function mockItem(id: string, overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 10,
    apCost: 1,
    equipModifiers: [],
    ...overrides,
  } as ItemTemplate;
}

describe('AP-система: мульти-AP сценарии', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['common_splinter_blade', mockItem('common_splinter_blade', { type: 'weapon' })],
      ]),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { cooldown: 3, apCost: 2, castTime: 2 })],
        ['magic_slap', mockAbility('magic_slap', { cooldown: 2, apCost: 1 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('игрок с maxAp = 2 может сделать два MOVE за один ход', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const r1 = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(r1.success).toBe(true);
    expect(r1.stateChanged).toBe(true);
    expect(r1.phases).toHaveLength(1);
    expect(sim.getState().player.ap).toBe(1);

    const r2 = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 1, dy: 0 });
    expect(r2.success).toBe(true);
    expect(r2.stateChanged).toBe(true);
    // Второй MOVE исчерпал AP, поэтому запустился ход окружения и AP восстановились.
    expect(r2.phases.some(p => p.side === 'ENVIRONMENT')).toBe(true);
    expect(sim.getState().player.ap).toBe(2);
  });

  it('ATTACK стоит 2 AP', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 });

    expect(result.success).toBe(false);
    expect(result.stateChanged).toBe(false);
    expectRejected(result, 'not_enough_ap');
  });

  it('ATTACK стоит 2 AP: при ap = 1 доступен MOVE, но не ATTACK', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 1 });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const attackResult = sim.dispatch({ type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 });
    expect(attackResult.success).toBe(false);
    expectRejected(attackResult, 'not_enough_ap');

    const moveResult = sim.dispatch({ type: 'MOVE', entityId: 'player', dx: 0, dy: 1 });
    expect(moveResult.success).toBe(true);
  });

  it('WAIT списывает все оставшиеся AP', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'WAIT', entityId: 'player' });

    expect(result.success).toBe(true);
    expect(result.stateChanged).toBe(true);
    // WAIT тратит все текущие AP; затем автоматически начинается следующий ход,
    // поэтому проверяем стоимость в дереве событий, а не текущее AP.
    const consumed = result.phases[0]?.actions[0]?.children.find(
      c => c.event.type === 'RESOURCE_CONSUMED' && (c.event as { amount: number }).amount === 2,
    );
    expect(consumed).toBeDefined();
    expect(result.phases.some(p => p.side === 'ENVIRONMENT')).toBe(true);
  });

  it('apCost способности считывается из шаблона', () => {
    // fireball стоит 2 AP — при ap = 2 ход завершается.
    const player1 = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state1 = makeGameState({ player: player1, entities: new Map<EntityId, Entity>([[player1.id, player1]]) });
    state1.visible[5]![5] = true;
    state1.visible[5]![6] = true;
    const sim1 = new GameSimulation(state1, defaultActionHandlerRegistry());

    const r1 = sim1.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] });
    expect(r1.success).toBe(true);
    expect(r1.stateChanged).toBe(true);
    expect(r1.phases.some(p => p.side === 'ENVIRONMENT')).toBe(true);

    // fireball стоит 2 AP — при ap = 1 использовать нельзя.
    const player2 = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 1,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state2 = makeGameState({ player: player2, entities: new Map<EntityId, Entity>([[player2.id, player2]]) });
    state2.visible[5]![5] = true;
    state2.visible[5]![6] = true;
    const sim2 = new GameSimulation(state2, defaultActionHandlerRegistry());

    const r2 = sim2.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] });
    expect(r2.success).toBe(false);
    expect(r2.stateChanged).toBe(false);
    expectRejected(r2, 'not_enough_ap');
  });

  it('при ap <= 0 автоматически запускается ход врагов', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 2, ap: 2 });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 });

    expect(result.success).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.phases.some(p => p.side === 'ENVIRONMENT')).toBe(true);
  });

  it('каст fireball (apCost = 2, castTime = 2) работает при maxAp = 2', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 2,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    // Начинаем каст. AP тратятся, ход завершается, beginNextPlayerTurn
    // уменьшает remainingTurns с 2 до 1.
    const r1 = sim.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] });
    expect(r1.success).toBe(true);
    expect(player.activeCast).not.toBeNull();
    expect(player.activeCast!.remainingTurns).toBe(1);
    expect(sim.getState().player.ap).toBe(2);

    // Первый WAIT — тик каста (remainingTurns → 0).
    const r2 = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(r2.success).toBe(true);
    expect(player.activeCast).not.toBeNull();
    expect(player.activeCast!.remainingTurns).toBe(0);

    // Второй WAIT — резолв каста.
    const r3 = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(r3.success).toBe(true);
    expect(player.activeCast).toBeNull();
    expect(enemy.hp).toBeLessThan(100);
  });

  it('EQUIP доступен при 0 AP, так как стоит 0', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      maxAp: 2,
      ap: 0,
      inventory: [{ instanceId: 'w1', templateId: 'common_splinter_blade', quantity: 1, grantedAbilities: [] }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    const result = sim.dispatch({ type: 'EQUIP', entityId: 'player', itemInstanceId: 'w1' });
    expect(result.success).toBe(true);
  });
});
