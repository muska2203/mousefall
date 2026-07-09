/**
 * Unit tests for animation builders.
 */

import {describe, expect, it} from 'vitest';
import {entityMovedBuilder} from '../../../../src/presentation/animation/builders/entityMoved';
import {actionAppliedBuilder} from '../../../../src/presentation/animation/builders/actionApplied';
import {entityDamagedBuilder} from '../../../../src/presentation/animation/builders/entityDamaged';
import {entityDiedBuilder} from '../../../../src/presentation/animation/builders/entityDied';
import {fogUpdatedBuilder} from '../../../../src/presentation/animation/builders/fogUpdated';
import {entityBumpedBuilder} from '../../../../src/presentation/animation/builders/entityBumped';
import {itemDroppedBuilder} from '../../../../src/presentation/animation/builders/itemDropped';
import {doorOpenedBuilder} from '../../../../src/presentation/animation/builders/doorOpened';
import {doorClosedBuilder} from '../../../../src/presentation/animation/builders/doorClosed';
import {entityHealedBuilder} from '../../../../src/presentation/animation/builders/entityHealed';

import {statusAppliedBuilder} from '../../../../src/presentation/animation/builders/statusApplied';
import {statusTickedBuilder} from '../../../../src/presentation/animation/builders/statusTicked';
import {statusStacksAdjustedBuilder} from '../../../../src/presentation/animation/builders/statusStacksAdjusted';
import type {GameEvent, GameState} from '../../../../src/simulation/types';

function makeMockState(): GameState {
  return {
    player: { id: 'player', x: 0, y: 0, hp: 20, maxHp: 25 } as any,
    entities: new Map([['enemy1', { id: 'enemy1', x: 3, y: 3, hp: 7, maxHp: 12 } as any]]),
  } as unknown as GameState;
}

describe('entityMovedBuilder', () => {
  it('creates MOVE step for walk', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', movementType: 'walk', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const nodes = entityMovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('MOVE');
  });

  it('creates JUMP step for jump', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', movementType: 'jump', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const nodes = entityMovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('JUMP');
  });
});

describe('actionAppliedBuilder', () => {
  it('creates ATTACK step for attack action', () => {
    const event: GameEvent = { type: 'ACTION_APPLIED', action: { type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 } };
    const nodes = actionAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('ATTACK');
  });

  it('returns null for non-attack action', () => {
    const event: GameEvent = { type: 'ACTION_APPLIED', action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } };
    const nodes = actionAppliedBuilder(event, [], makeMockState());

    expect(nodes).toBeNull();
  });
});

describe('entityDamagedBuilder', () => {
  it('wraps HP_CHANGE inside DAMAGE for player with HP', () => {
    const event: GameEvent = { type: 'ENTITY_DAMAGED', targetId: 'player', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 0, y: 0 } };
    const nodes = entityDamagedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toHaveLength(1);
    expect(nodes![0]!.children[0]!.step.type).toBe('HP_CHANGE');
  });

  it('wraps HP_CHANGE inside DAMAGE for enemy with HP', () => {
    const event: GameEvent = { type: 'ENTITY_DAMAGED', targetId: 'enemy1', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 3, y: 3 } };
    const nodes = entityDamagedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toHaveLength(1);
    expect(nodes![0]!.children[0]!.step.type).toBe('HP_CHANGE');
  });

  it('creates only DAMAGE step for target without HP', () => {
    const state = makeMockState();
    state.entities.set('door1', { id: 'door1', x: 1, y: 1 } as any);
    const event: GameEvent = { type: 'ENTITY_DAMAGED', targetId: 'door1', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 1, y: 1 } };
    const nodes = entityDamagedBuilder(event, [], state);

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toHaveLength(0);
  });
});

describe('entityDiedBuilder', () => {
  it('creates DEATH step', () => {
    const event: GameEvent = { type: 'ENTITY_DIED', entityId: 'enemy1', position: { x: 3, y: 3 } };
    const nodes = entityDiedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DEATH');
  });
});

describe('fogUpdatedBuilder', () => {
  it('creates FOG_UPDATE step', () => {
    const event: GameEvent = { type: 'FOG_UPDATED', newlyVisible: [{ x: 1, y: 1 }] };
    const nodes = fogUpdatedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('FOG_UPDATE');
  });
});

describe('entityBumpedBuilder', () => {
  it('creates BOUNCE step', () => {
    const event: GameEvent = { type: 'ENTITY_BUMPED', entityId: 'player', position: { x: 1, y: 1 }, dx: 1, dy: 0 };
    const nodes = entityBumpedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('BOUNCE');
  });
});

describe('itemDroppedBuilder', () => {
  it('creates ITEM_DROP step', () => {
    const event: GameEvent = {
      type: 'ITEM_DROPPED',
      dropperEntityId: 'enemy1',
      itemInstanceId: 'item_1',
      containerId: 'floor_item_container_1',
      templateId: 'health_potion',
      position: { x: 3, y: 3 },
      from: { x: 2, y: 2 },
    };
    const nodes = itemDroppedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('ITEM_DROP');
  });
});

describe('door builders', () => {
  it('creates UI_FLOATING_TEXT for DOOR_OPENED', () => {
    const event: GameEvent = { type: 'DOOR_OPENED', position: { x: 1, y: 1 } };
    const nodes = doorOpenedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });

  it('creates UI_FLOATING_TEXT for DOOR_CLOSED', () => {
    const event: GameEvent = { type: 'DOOR_CLOSED', position: { x: 1, y: 1 } };
    const nodes = doorClosedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });
});

describe('entityHealedBuilder', () => {
  it('creates UI_FLOATING_TEXT with heal amount', () => {
    const event: GameEvent = { type: 'ENTITY_HEALED', entityId: 'player', amount: 10, newHp: 20, position: { x: 0, y: 0 } };
    const nodes = entityHealedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
    expect((nodes![0]!.step as any).text).toBe('+10');
  });
});


describe('status builders', () => {
  it('creates STATUS_BURST for STATUS_APPLIED', () => {
    const event: GameEvent = { type: 'STATUS_APPLIED', entityId: 'enemy1', effect: { type: 'poisoned', duration: 3, value: 2 } as any };
    const nodes = statusAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });

  it('creates STATUS_BURST for STATUS_TICKED', () => {
    const event: GameEvent = { type: 'STATUS_TICKED', entityId: 'enemy1', effectTypes: ['burning'] };
    const nodes = statusTickedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });

  it('creates STATUS_BURST for STATUS_STACKS_ADJUSTED', () => {
    const event: GameEvent = { type: 'STATUS_STACKS_ADJUSTED', entityId: 'enemy1', statusType: 'poisoned', stacks: 2 };
    const nodes = statusStacksAdjustedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });
});
