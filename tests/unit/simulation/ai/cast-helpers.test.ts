import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makeEnemy } from '../../../fixtures/gameState';
import { getPreparableAbilities } from '../../../../src/simulation/ai/cast-helpers';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 2,
    apCost: 1,
    aiPreparable: true,
    ...overrides,
  } as AbilityTemplate;
}

describe('getPreparableAbilities', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { cooldown: 2, apCost: 1, aiPreparable: true })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('returns no preparable abilities for silenced enemy', () => {
    const state = makeGameState();
    const enemy = makeEnemy({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      statusEffects: [{ type: 'silenced', duration: 1, value: 0, statModifiers: null }],
    });
    state.entities.set(enemy.id, enemy);

    const preparable = getPreparableAbilities(enemy, state);
    expect(preparable).toHaveLength(0);
  });

  it('returns preparable abilities for enemy without silenced', () => {
    const state = makeGameState();
    const enemy = makeEnemy({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      statusEffects: [],
    });
    state.entities.set(enemy.id, enemy);

    const preparable = getPreparableAbilities(enemy, state);
    expect(preparable).toHaveLength(1);
    expect(preparable[0]!.templateId).toBe('fireball');
  });
});
