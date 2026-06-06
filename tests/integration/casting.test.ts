import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../fixtures/gameState';
import { GameSimulation } from '../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import type { AbilityTemplate } from '../../src/content/schemas';
import { initSkillRegistry } from '../../src/simulation/skills/index';
import { executeApplyStatusIntent } from '../../src/simulation/systems/intents/apply-status-intent-executer';
import { ExecutionBuilder } from '../../src/simulation/systems/actions/types';

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

describe('Интеграция: кастинг способностей', () => {
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

  it('успешный каст fireball (2 хода)', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ x: 6, y: 5, hp: 100, maxHp: 100, aiStrategyId: 'hunter' });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const sim = GameSimulation.loadSavedGame(state);

    // Шаг 1: начинаем каст (castTime=2).
    // AP тратится, затем ход окружения и beginNextPlayerTurn
    // уменьшают remainingTurns с 2 до 1. MP также восстанавливается на 1 (5% от 20).
    const r1 = sim.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] });
    expect(r1.success).toBe(true);
    expect(player.activeCast).not.toBeNull();
    expect(player.activeCast!.remainingTurns).toBe(1);

    // Шаг 2: ждём — ход окружения + beginNextPlayerTurn уменьшает remainingTurns с 1 до 0
    const r2 = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(r2.success).toBe(true);
    expect(player.activeCast).not.toBeNull();
    expect(player.activeCast!.remainingTurns).toBe(0);

    // Шаг 3: ещё один WAIT — ход окружения + beginNextPlayerTurn резолвит каст (remainingTurns === 0)
    const r3 = sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(r3.success).toBe(true);
    expect(player.activeCast).toBeNull();

    // Проверяем, что урон нанесён
    expect(enemy.hp).toBeLessThan(100);

    // Кулдаун начался при резолве (3), но сразу уменьшился на 1 в beginNextPlayerTurn
    const ability = player.abilities.find(a => a.templateId === 'fireball');
    expect(ability?.currentCooldown).toBe(2);
  });

  it('прерывание каста станом', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    // Начинаем каст
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'USE_ABILITY', entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] });
    expect(player.activeCast).not.toBeNull();

    // Накладываем stunned вручную
    const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'WAIT', entityId: 'player' } });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: 'player', status: { type: 'stunned', duration: 1, value: 0, statModifiers: null } }, builder, builder.root);

    expect(player.activeCast).toBeNull();
  });

  it('AI-враг начинает каст', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[6]![5] = true;
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      x: 6,
      y: 5,
      aiStrategyId: 'hunter',
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const sim = GameSimulation.loadSavedGame(state);

    // Запускаем ход окружения — враг должен начать каст
    sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(enemy.activeCast).not.toBeNull();
    expect(enemy.activeCast!.abilityId).toBe('fireball');
    expect(enemy.activeCast!.remainingTurns).toBe(2);

    // Следующий ход окружения — тик каста (remainingTurns → 1)
    sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(enemy.activeCast).not.toBeNull();
    expect(enemy.activeCast!.remainingTurns).toBe(1);

    // Третий ход окружения — тик каста (remainingTurns → 0)
    sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(enemy.activeCast).not.toBeNull();
    expect(enemy.activeCast!.remainingTurns).toBe(0);

    // Четвёртый ход окружения — авто-резолв
    sim.dispatch({ type: 'WAIT', entityId: 'player' });
    expect(enemy.activeCast).toBeNull();
    // Урон должен был нанестись игроку (враг в (6,5), игрок в (5,5) — в радиусе 1)
    expect(player.hp).toBeLessThan(100);
  });
});
