/**
 * Unit tests for AI mode resolution.
 */

import {describe, expect, it} from 'vitest';
import {resolveAIMode} from '../../../src/presentation/primaryStatus';
import type {PlayerEntity, EnemyEntity, DoorEntity} from '../../../src/simulation/types';

function makePlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'player',
    type: 'player',
    statusEffects: [],
    ...overrides,
  } as PlayerEntity;
}

function makeEnemy(aiMode: 'idle' | 'chase' | 'return', overrides: Partial<EnemyEntity> = {}): EnemyEntity {
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
      preparedAbility: null,
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
    interactionKind: 'door',
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

describe('resolveAIMode', () => {
  it('returns AI mode for enemy when no prepared intent is active', () => {
    expect(resolveAIMode(makeEnemy('idle'))).toBe('idle');
    expect(resolveAIMode(makeEnemy('chase'))).toBe('chase');
    expect(resolveAIMode(makeEnemy('return'))).toBe('return');
  });

  it('returns "prepared" for enemy with preparedAbility', () => {
    const enemy = makeEnemy('chase', {
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        preparedAbility: {abilityId: 'swoop', targets: [{x: 0, y: 0}]},
      },
    });
    expect(resolveAIMode(enemy)).toBe('prepared');
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
        preparedAbility: {abilityId: 'swoop', targets: [{x: 0, y: 0}]},
      },
    });
    expect(resolveAIMode(enemy)).toBe('prepared');

    enemy.aiState.preparedAbility = null;
    expect(resolveAIMode(enemy)).toBe('chase');
  });

  it('returns null for player regardless of status effects', () => {
    expect(resolveAIMode(makePlayer())).toBeNull();
    expect(resolveAIMode(makePlayer({
      statusEffects: [{type: 'stunned', duration: 2, value: 0, statModifiers: null}],
    }))).toBeNull();
  });

  it('returns null for non-actor entities', () => {
    expect(resolveAIMode(makeDoor())).toBeNull();
  });
});
