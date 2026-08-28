/**
 * Тесты stat-модификаторов статусов (StatusTemplate.statModifiers).
 *
 * Проверяет:
 * - применение модификатора при наложении статуса (RESTORE_AP до maxAp+1);
 * - снятие модификатора на всех путях удаления статуса:
 *   expire через REMOVE_EXPIRED_STATUS_EFFECTS (после TICK_STATUS_EFFECTS),
 *   вытеснение mutuallyExclusiveWith, обнуление стаков через ADJUST_STATUS_STACKS;
 * - регрессию реального шаблона dazed (штраф −1 maxAp, не ниже 0);
 * - эффективный maxAp в снапшоте getPlayerStats().
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeEnemy, makeGameState, makePlayer, makeStateWithPlayer } from '../../../fixtures/gameState';
import { executeApplyStatusIntent } from '../../../../src/simulation/systems/intents/apply-status-intent-executer';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { executeRemoveExpiredStatusEffectsIntent } from '../../../../src/simulation/systems/intents/remove-expired-status-effects-intent-executer';
import { executeAdjustStatusStacksIntent } from '../../../../src/simulation/systems/intents/adjust-status-stacks-intent-executer';
import { executeRestoreApIntent } from '../../../../src/simulation/systems/intents/restore-ap-intent-executer';
import type { StatusEffect } from '../../../../src/simulation/core-types';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { GameState } from '../../../../src/simulation/types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { StatusTemplateSchema, type StatusTemplate } from '../../../../src/content/schemas';
import { dazed as dazedTemplate } from '../../../../src/content/templates/statuses/dazed';
import { createTestSimulation } from '../../../helpers/simulation';

function mockStatus(id: string, overrides: Partial<StatusTemplate> = {}): StatusTemplate {
  return {
    id,
    ruleIds: [],
    statusCategory: 'physical',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
    ...overrides,
  };
}

/** Накладывает статус на сущность через общий исполнитель APPLY_STATUS. */
function applyStatus(state: GameState, entityId: string, status: StatusEffect): void {
  const builder = new ExecutionBuilder({
    type: 'STATUS_APPLIED', isFieldEvent: true,
    entityId, sourceEntityId: null, effect: status,
  });
  executeApplyStatusIntent(
    state,
    { type: 'APPLY_STATUS', entityId, sourceEntityId: null, status },
    builder,
    builder.root,
  );
}

/** Восстанавливает AP сущности через общий исполнитель RESTORE_AP. */
function restoreAp(state: GameState, entityId: string): void {
  const builder = new ExecutionBuilder({
    type: 'TURN_BEGAN', isFieldEvent: false, side: 'enemies', round: 1, actorId: entityId,
  });
  executeRestoreApIntent(state, { type: 'RESTORE_AP', entityId }, builder, builder.root);
}

/** Есть ли у актора активный модификатор стата maxAp. */
function hasMaxApModifier(actor: { statModifiers: { stat: string }[] }): boolean {
  return actor.statModifiers.some((m) => m.stat === 'maxAp');
}

describe('status stat modifiers', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([
        // Тестовый статус с бонусом +1 к maxAp.
        ['regenerating', mockStatus('regenerating', {
          statModifiers: [{ stat: 'maxAp', value: 1, op: 'add' }],
        })],
        // Статус A с бонусом +1 к maxAp, вытесняемый статусом B.
        ['counterattack', mockStatus('counterattack', {
          statModifiers: [{ stat: 'maxAp', value: 1, op: 'add' }],
        })],
        ['bulwark', mockStatus('bulwark', {
          mutuallyExclusiveWith: ['counterattack'],
        })],
        // Стакующийся статус с бонусом +1 к maxAp.
        ['bleeding', mockStatus('bleeding', {
          statModifiers: [{ stat: 'maxAp', value: 1, op: 'add' }],
        })],
        // Реальный шаблон dazed (штраф −1 к maxAp) — через Zod-парс для дефолтов.
        ['dazed', StatusTemplateSchema.parse(dazedTemplate)],
      ]),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('наложение статуса с maxAp-модификатором повышает восстановление AP', () => {
    const enemy = makeEnemy({ ap: 0, maxAp: 2 });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    applyStatus(state, enemy.id, { type: 'regenerating', duration: 3, value: 0, statModifiers: null });
    expect(hasMaxApModifier(enemy)).toBe(true);

    restoreAp(state, enemy.id);

    // maxAp 2 + 1 от статуса.
    expect(enemy.ap).toBe(3);
  });

  it('expire статуса снимает модификатор: RESTORE_AP возвращает базовый maxAp', () => {
    const enemy = makeEnemy({ ap: 0, maxAp: 2 });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    applyStatus(state, enemy.id, { type: 'regenerating', duration: 1, value: 0, statModifiers: null });
    expect(hasMaxApModifier(enemy)).toBe(true);

    const builder = new ExecutionBuilder({
      type: 'STATUS_TICKED', isFieldEvent: true, entityId: enemy.id, effectTypes: [], tags: [],
    });
    executeTickStatusEffectsIntent(
      state,
      { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' },
      builder,
      builder.root,
    );
    // Снятие истёкших — отдельный интент после реакций на STATUS_TICKED (с 2026-08-28).
    executeRemoveExpiredStatusEffectsIntent(
      state,
      { type: 'REMOVE_EXPIRED_STATUS_EFFECTS', entityId: enemy.id },
      builder,
      builder.root,
    );

    expect(enemy.statusEffects).toHaveLength(0);
    expect(hasMaxApModifier(enemy)).toBe(false);

    restoreAp(state, enemy.id);
    expect(enemy.ap).toBe(2);
  });

  it('вытеснение взаимоисключающим статусом снимает модификатор вытесненного', () => {
    const enemy = makeEnemy({ ap: 0, maxAp: 2 });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    applyStatus(state, enemy.id, { type: 'counterattack', duration: 3, value: 0, statModifiers: null });
    expect(hasMaxApModifier(enemy)).toBe(true);

    applyStatus(state, enemy.id, { type: 'bulwark', duration: 3, value: 0, statModifiers: null });

    expect(enemy.statusEffects.map((e) => e.type)).toEqual(['bulwark']);
    expect(hasMaxApModifier(enemy)).toBe(false);

    restoreAp(state, enemy.id);
    expect(enemy.ap).toBe(2);
  });

  it('обнуление стаков через ADJUST_STATUS_STACKS снимает модификатор', () => {
    const enemy = makeEnemy({ ap: 0, maxAp: 2 });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    applyStatus(state, enemy.id, { type: 'bleeding', duration: 3, value: 0, statModifiers: null, stacks: 2 });
    expect(hasMaxApModifier(enemy)).toBe(true);

    const builder = new ExecutionBuilder({
      type: 'TURN_BEGAN', isFieldEvent: false, side: 'enemies', round: 1, actorId: enemy.id,
    });
    executeAdjustStatusStacksIntent(
      state,
      { type: 'ADJUST_STATUS_STACKS', entityId: enemy.id, statusType: 'bleeding', delta: -2 },
      builder,
      builder.root,
    );

    expect(enemy.statusEffects).toHaveLength(0);
    expect(hasMaxApModifier(enemy)).toBe(false);

    restoreAp(state, enemy.id);
    expect(enemy.ap).toBe(2);
  });

  it('регрессия dazed: RESTORE_AP при активном dazed даёт maxAp − 1', () => {
    const player = makePlayer({ ap: 0, maxAp: 3 });
    const state = makeStateWithPlayer(player);

    applyStatus(state, player.id, { type: 'dazed', duration: 2, value: 0, statModifiers: null });
    restoreAp(state, player.id);

    expect(player.ap).toBe(2);
  });

  it('регрессия dazed: восстановление AP не опускается ниже 0', () => {
    const player = makePlayer({ ap: 0, maxAp: 1 });
    const state = makeStateWithPlayer(player);

    applyStatus(state, player.id, { type: 'dazed', duration: 2, value: 0, statModifiers: null });
    restoreAp(state, player.id);

    expect(player.ap).toBe(0);
  });

  it('getPlayerStats возвращает эффективный maxAp при активном статусе с модификатором', () => {
    const player = makePlayer({ ap: 1, maxAp: 2 });
    const state = makeStateWithPlayer(player);

    applyStatus(state, player.id, { type: 'regenerating', duration: 3, value: 0, statModifiers: null });

    const sim = createTestSimulation(state);
    expect(sim.getPlayerStats().maxAp).toBe(3);
  });
});
