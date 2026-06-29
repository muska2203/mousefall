/**
 * Unit tests for primary status resolution.
 */

import {describe, expect, it} from 'vitest';
import {resolvePrimaryStatus} from '../../../src/presentation/primaryStatus';
import type {PlayerEntity, EnemyEntity, DoorEntity} from '../../../src/simulation/types';

function makePlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'player',
    type: 'player',
    statusEffects: [],
    activeCast: null,
    ...overrides,
  } as PlayerEntity;
}

function makeEnemy(aiMode: 'idle' | 'alert' | 'chase' | 'return', overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 'enemy1',
    type: 'enemy',
    statusEffects: [],
    activeCast: null,
    aiState: {
      strategy: 'hunter',
      mode: aiMode,
      targetX: null,
      targetY: null,
      homeX: 0,
      homeY: 0,
      alertTurns: 0,
      preparedIntent: null,
    },
    ...overrides,
  } as EnemyEntity;
}

function makeDoor(): DoorEntity {
  return {
    id: 'door1',
    type: 'door',
    x: 0,
    y: 0,
    blocksMovement: true,
    displayName: 'Door',
    templateId: 'wooden_door',
    hp: 10,
    maxHp: 10,
    armor: 0,
    isAlive: true,
    isOpen: false,
    statusEffects: [],
  } as DoorEntity;
}

describe('resolvePrimaryStatus', () => {
  it('returns AI mode for enemy when no overlay is active', () => {
    expect(resolvePrimaryStatus(makeEnemy('idle'))).toBe('idle');
    expect(resolvePrimaryStatus(makeEnemy('alert'))).toBe('alert');
    expect(resolvePrimaryStatus(makeEnemy('chase'))).toBe('chase');
    expect(resolvePrimaryStatus(makeEnemy('return'))).toBe('return');
  });

  it('overlay stunned overrides AI mode for enemy', () => {
    const enemy = makeEnemy('chase', {
      statusEffects: [{type: 'stunned', duration: 2, value: 0, statModifiers: null}],
    });
    expect(resolvePrimaryStatus(enemy)).toBe('stunned');
  });

  it('overlay casting overrides AI mode for enemy', () => {
    const enemy = makeEnemy('chase', {
      activeCast: {abilityId: 'fireball', fixedTargets: [], remainingTurns: 2},
    });
    expect(resolvePrimaryStatus(enemy)).toBe('casting');
  });

  it('overlay prepared overrides AI mode for enemy', () => {
    const enemy = makeEnemy('chase', {
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        alertTurns: 0,
        preparedIntent: {abilityId: 'swoop', fixedTargets: [{x: 0, y: 0}]},
      },
    });
    expect(resolvePrimaryStatus(enemy)).toEqual({type: 'prepared', abilityIcon: null});
  });

  it('resolves prepared ability icon when resolver is provided', () => {
    const enemy = makeEnemy('chase', {
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        alertTurns: 0,
        preparedIntent: {abilityId: 'swoop', fixedTargets: [{x: 0, y: 0}]},
      },
    });
    expect(resolvePrimaryStatus(enemy, (id) => `/assets/skills/${id}.png`)).toEqual({
      type: 'prepared',
      abilityIcon: '/assets/skills/swoop.png',
    });
  });

  it('stunned has priority over casting and prepared for enemy', () => {
    const enemy = makeEnemy('chase', {
      statusEffects: [{type: 'stunned', duration: 2, value: 0, statModifiers: null}],
      activeCast: {abilityId: 'fireball', fixedTargets: [], remainingTurns: 2},
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        alertTurns: 0,
        preparedIntent: {abilityId: 'swoop', fixedTargets: [{x: 0, y: 0}]},
      },
    });
    expect(resolvePrimaryStatus(enemy)).toBe('stunned');
  });

  it('returns stunned for player when affected', () => {
    const player = makePlayer({
      statusEffects: [{type: 'stunned', duration: 2, value: 0, statModifiers: null}],
    });
    expect(resolvePrimaryStatus(player)).toBe('stunned');
  });

  it('returns casting for player when active cast exists', () => {
    const player = makePlayer({
      activeCast: {abilityId: 'fireball', fixedTargets: [], remainingTurns: 2},
    });
    expect(resolvePrimaryStatus(player)).toBe('casting');
  });

  it('returns null for player without overlay statuses', () => {
    expect(resolvePrimaryStatus(makePlayer())).toBeNull();
  });

  it('returns null for non-actor entities', () => {
    expect(resolvePrimaryStatus(makeDoor())).toBeNull();
  });
});
