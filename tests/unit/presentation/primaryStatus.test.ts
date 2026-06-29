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
    ...overrides,
  } as PlayerEntity;
}

function makeEnemy(aiMode: 'idle' | 'alert' | 'chase' | 'return', overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 'enemy1',
    type: 'enemy',
    statusEffects: [],
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
  it('returns AI mode for enemy when no prepared intent is active', () => {
    expect(resolvePrimaryStatus(makeEnemy('idle'))).toBe('idle');
    expect(resolvePrimaryStatus(makeEnemy('alert'))).toBe('alert');
    expect(resolvePrimaryStatus(makeEnemy('chase'))).toBe('chase');
    expect(resolvePrimaryStatus(makeEnemy('return'))).toBe('return');
  });

  it('returns "prepared" for enemy with preparedIntent', () => {
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
    expect(resolvePrimaryStatus(enemy)).toBe('prepared');
  });

  it('preserves base AI mode after prepared intent is cleared', () => {
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
    expect(resolvePrimaryStatus(enemy)).toBe('prepared');

    enemy.aiState.preparedIntent = null;
    expect(resolvePrimaryStatus(enemy)).toBe('chase');
  });

  it('returns null for player regardless of status effects', () => {
    expect(resolvePrimaryStatus(makePlayer())).toBeNull();
    expect(resolvePrimaryStatus(makePlayer({
      statusEffects: [{type: 'stunned', duration: 2, value: 0, statModifiers: null}],
    }))).toBeNull();
  });

  it('returns null for non-actor entities', () => {
    expect(resolvePrimaryStatus(makeDoor())).toBeNull();
  });
});
