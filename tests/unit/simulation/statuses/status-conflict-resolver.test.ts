import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveStatusBatch } from '../../../../src/simulation/systems/statuses/status-conflict-resolver';
import { makeGameState } from '../../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { StatusTemplate } from '../../../../src/content/schemas';
import type { Intent, StatusEffectType } from '../../../../src/simulation/core-types';

function mockStatusTemplate(overrides: Partial<StatusTemplate> & { id: string }): StatusTemplate {
  return {
    ruleIds: [],
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    ...overrides,
  };
}

function makeApplyStatusIntent(statusType: StatusEffectType, entityId: string = 'enemy_test_1'): Intent {
  return {
    type: 'APPLY_STATUS',
    entityId,
    sourceEntityId: null,
    status: {
      type: statusType,
      duration: 1,
      value: 0,
      statModifiers: null,
    },
  };
}

describe('resolveStatusBatch', () => {
  beforeEach(() => {
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([
        ['burning', mockStatusTemplate({
          id: 'burning',
          statusCategory: 'elemental',
          categoryPriority: 1,
          mutuallyExclusiveWith: ['frozen'],
        })],
        ['frozen', mockStatusTemplate({
          id: 'frozen',
          statusCategory: 'elemental',
          categoryPriority: 1,
          mutuallyExclusiveWith: ['burning'],
        })],
        ['stunned', mockStatusTemplate({
          id: 'stunned',
          statusCategory: 'physical',
          categoryPriority: 2,
          mutuallyExclusiveWith: ['dazed'],
        })],
        ['dazed', mockStatusTemplate({
          id: 'dazed',
          statusCategory: 'physical',
          categoryPriority: 1,
          blockedBy: ['stunned'],
        })],
        ['poisoned', mockStatusTemplate({ id: 'poisoned', statusCategory: 'poison', categoryPriority: 0 })],
      ]),
      tileEffects: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('оставляет первый интент при дублировании статуса из разных слоёв', () => {
    const state = makeGameState();
    const intents: Intent[] = [
      makeApplyStatusIntent('burning'),
      makeApplyStatusIntent('burning'),
    ];

    const resolved = resolveStatusBatch(state, intents);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ type: 'APPLY_STATUS', entityId: 'enemy_test_1' });
    expect((resolved[0] as Extract<Intent, { type: 'APPLY_STATUS' }>).status.type).toBe('burning');
  });

  it('при burning и frozen в одной категории оставляет первый по порядку', () => {
    const state = makeGameState();
    const intents: Intent[] = [
      makeApplyStatusIntent('burning'),
      makeApplyStatusIntent('frozen'),
    ];

    const resolved = resolveStatusBatch(state, intents);

    expect(resolved).toHaveLength(1);
    expect((resolved[0] as Extract<Intent, { type: 'APPLY_STATUS' }>).status.type).toBe('burning');
  });

  it('выбирает stunned вместо dazed из-за более высокого приоритета', () => {
    const state = makeGameState();
    const intents: Intent[] = [
      makeApplyStatusIntent('dazed'),
      makeApplyStatusIntent('stunned'),
    ];

    const resolved = resolveStatusBatch(state, intents);

    expect(resolved).toHaveLength(1);
    expect((resolved[0] as Extract<Intent, { type: 'APPLY_STATUS' }>).status.type).toBe('stunned');
  });

  it('сохраняет не-APPLY_STATUS интенты и их порядок', () => {
    const state = makeGameState();
    const intents: Intent[] = [
      { type: 'DAMAGE', entityId: 'enemy_test_1', sourceEntityId: null, damage: 5, tags: [] },
      makeApplyStatusIntent('poisoned'),
      { type: 'HEAL', entityId: 'enemy_test_1', amount: 3 },
    ];

    const resolved = resolveStatusBatch(state, intents);

    expect(resolved).toHaveLength(3);
    expect(resolved[0]!.type).toBe('DAMAGE');
    expect(resolved[1]!.type).toBe('APPLY_STATUS');
    expect(resolved[2]!.type).toBe('HEAL');
  });
});
