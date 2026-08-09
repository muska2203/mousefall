/**
 * Unit tests for animation builders.
 */

import {beforeEach, describe, expect, it, afterEach} from 'vitest';
import {entityMovedBuilder} from '../../../../src/presentation/animation/builders/entityMoved';
import {actionAppliedBuilder} from '../../../../src/presentation/animation/builders/actionApplied';
import {entityDamagedBuilder} from '../../../../src/presentation/animation/builders/entityDamaged';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {ItemTemplate} from '../../../../src/content/schemas';
import {entityDiedBuilder} from '../../../../src/presentation/animation/builders/entityDied';
import {fogUpdatedBuilder} from '../../../../src/presentation/animation/builders/fogUpdated';
import {entityBumpedBuilder} from '../../../../src/presentation/animation/builders/entityBumped';
import {itemDroppedBuilder} from '../../../../src/presentation/animation/builders/itemDropped';
import {doorOpenedBuilder} from '../../../../src/presentation/animation/builders/doorOpened';
import {doorClosedBuilder} from '../../../../src/presentation/animation/builders/doorClosed';
import {entityHealedBuilder} from '../../../../src/presentation/animation/builders/entityHealed';
import {statusBlockedBuilder} from '../../../../src/presentation/animation/builders/statusBlocked';
import {statusRemovedBuilder} from '../../../../src/presentation/animation/builders/statusRemoved';
import {entityCollidedBuilder} from '../../../../src/presentation/animation/builders/entityCollided';
import {entityDisplacedBuilder} from '../../../../src/presentation/animation/builders/entityDisplaced';

import {statusAppliedBuilder} from '../../../../src/presentation/animation/builders/statusApplied';
import {statusTickedBuilder} from '../../../../src/presentation/animation/builders/statusTicked';
import {statusStacksAdjustedBuilder} from '../../../../src/presentation/animation/builders/statusStacksAdjusted';
import {
  tileEffectChangedBuilder,
  tileEffectRemovedBuilder,
  tileEffectStatusAppliedBuilder,
  tileEffectStatusRemovedBuilder,
} from '../../../../src/presentation/animation/builders/tileEffect';
import {tileExplodedBuilder} from '../../../../src/presentation/animation/builders/tileExploded';
import type {GameEvent, GameState} from '../../../../src/simulation/types';

function makeMockState(): GameState {
  return {
    player: { id: 'player', x: 0, y: 0, hp: 20, maxHp: 25 } as any,
    entities: new Map([['enemy1', { id: 'enemy1', x: 3, y: 3, hp: 7, maxHp: 12 } as any]]),
  } as unknown as GameState;
}

describe('entityMovedBuilder', () => {
  it('creates MOVE step for walk', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', isFieldEvent: true, movementType: 'walk', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const nodes = entityMovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('MOVE');
  });

  it('creates JUMP step for jump', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', isFieldEvent: true, movementType: 'jump', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const nodes = entityMovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('JUMP');
  });
});

describe('actionAppliedBuilder', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['water_ball', {
          id: 'water_ball',
          type: 'consumable',
          spriteId: 'water_ball',
          stackable: true,
          maxStack: 5,
          value: 15,
          rarity: 'common',
          abilityPool: [],
          fixedModifiers: [],
          grantedAbilities: [],
          apCost: 1,
          consumable: { effect: 'spawn_tile_effect', tileEffectType: 'water', radius: 1, range: 5 },
        } as unknown as ItemTemplate],
      ]),
      abilities: new Map(),
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

  it('creates ATTACK step for attack action', () => {
    const event: GameEvent = { type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 } };
    const nodes = actionAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('ATTACK');
  });

  it('returns null for non-attack action', () => {
    const event: GameEvent = { type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } };
    const nodes = actionAppliedBuilder(event, [], makeMockState());

    expect(nodes).toBeNull();
  });

  it('creates ITEM_THROW step for USE_ITEM with targetPosition', () => {
    const state = makeMockState();
    state.player.inventory = [{ instanceId: 'wb1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }];
    state.player.x = 1;
    state.player.y = 1;

    const event: GameEvent = {
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: {
        type: 'USE_ITEM',
        entityId: 'player',
        itemInstanceId: 'wb1',
        templateId: 'water_ball',
        targetPosition: { x: 3, y: 3 },
      },
    };
    const child = { step: { type: 'PARTICLE_BURST' as const, x: 3, y: 3, color: 0xffffff, count: 1 }, children: [] };
    const nodes = actionAppliedBuilder(event, [child], state);

    expect(nodes).toHaveLength(1);
    const step = nodes![0]!.step;
    expect(step.type).toBe('ITEM_THROW');
    if (step.type !== 'ITEM_THROW') return;
    expect(step.from).toEqual({ x: 1, y: 1 });
    expect(step.to).toEqual({ x: 3, y: 3 });
    expect(step.templateId).toBe('water_ball');
    expect(step.spriteId).toBe('water_ball');
    expect(step.affectedEntityId).toBe('player');
    expect(nodes![0]!.children).toHaveLength(1);
    expect(nodes![0]!.children[0]).toBe(child);
  });

  it('creates ITEM_THROW step even if item was consumed before animation build', () => {
    const state = makeMockState();
    // Предмет уже удалён из инвентаря, но templateId передан в действии.
    state.player.inventory = [];
    state.player.x = 1;
    state.player.y = 1;

    const event: GameEvent = {
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: {
        type: 'USE_ITEM',
        entityId: 'player',
        itemInstanceId: 'wb1',
        templateId: 'water_ball',
        targetPosition: { x: 3, y: 3 },
      },
    };
    const nodes = actionAppliedBuilder(event, [], state);

    expect(nodes).toHaveLength(1);
    const step = nodes![0]!.step;
    expect(step.type).toBe('ITEM_THROW');
    if (step.type !== 'ITEM_THROW') return;
    expect(step.spriteId).toBe('water_ball');
  });

  it('returns null for USE_ITEM without targetPosition', () => {
    const state = makeMockState();
    state.player.inventory = [{ instanceId: 'wb1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }];

    const event: GameEvent = {
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: {
        type: 'USE_ITEM',
        entityId: 'player',
        itemInstanceId: 'wb1',
        templateId: 'water_ball',
      },
    };
    expect(actionAppliedBuilder(event, [], state)).toBeNull();
  });

  it('returns null for unknown templateId', () => {
    const state = makeMockState();
    state.player.inventory = [];
    state.player.x = 1;
    state.player.y = 1;

    const event: GameEvent = {
      type: 'ACTION_APPLIED',
      isFieldEvent: false,
      action: {
        type: 'USE_ITEM',
        entityId: 'player',
        itemInstanceId: 'wb1',
        templateId: 'unknown_item',
        targetPosition: { x: 3, y: 3 },
      },
    };
    expect(actionAppliedBuilder(event, [], state)).toBeNull();
  });
});

describe('entityDamagedBuilder', () => {
  it('creates DAMAGE step for player with HP', () => {
    const event: GameEvent = { type: 'ENTITY_DAMAGED', isFieldEvent: true, targetId: 'player', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 0, y: 0 } };
    const nodes = entityDamagedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toHaveLength(0);
  });

  it('creates DAMAGE step for enemy with HP', () => {
    const event: GameEvent = { type: 'ENTITY_DAMAGED', isFieldEvent: true, targetId: 'enemy1', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 3, y: 3 } };
    const nodes = entityDamagedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toHaveLength(0);
  });

  it('preserves passed child nodes inside DAMAGE', () => {
    const child = { step: { type: 'DEATH' as const, entityId: 'enemy1' }, children: [] };
    const event: GameEvent = { type: 'ENTITY_DAMAGED', isFieldEvent: true, targetId: 'enemy1', sourceEntityId: null, tags: ['damage.physical.blunt'], damage: 5, position: { x: 3, y: 3 } };
    const nodes = entityDamagedBuilder(event, [child], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    expect(nodes![0]!.children).toContain(child);
  });

  it('adds UI_FLOATING_TEXT crit node when event has crit tag', () => {
    const event: GameEvent = { type: 'ENTITY_DAMAGED', isFieldEvent: true, targetId: 'enemy1', sourceEntityId: 'player', tags: ['damage.physical.slashing', 'crit'], damage: 9, position: { x: 3, y: 3 } };
    const nodes = entityDamagedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(2);
    expect(nodes![0]!.step.type).toBe('DAMAGE');
    const critStep = nodes![1]!.step;
    expect(critStep.type).toBe('UI_FLOATING_TEXT');
    expect((critStep as { textKey?: string }).textKey).toBe('system.animation.crit');
  });
});

describe('entityDiedBuilder', () => {
  it('creates DEATH step', () => {
    const event: GameEvent = { type: 'ENTITY_DIED', isFieldEvent: true, entityId: 'enemy1', position: { x: 3, y: 3 } };
    const nodes = entityDiedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('DEATH');
  });
});

describe('fogUpdatedBuilder', () => {
  it('creates FOG_UPDATE step', () => {
    const event: GameEvent = { type: 'FOG_UPDATED', isFieldEvent: true, newlyVisible: [{ x: 1, y: 1 }] };
    const nodes = fogUpdatedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('FOG_UPDATE');
  });
});

describe('entityBumpedBuilder', () => {
  it('creates BOUNCE step', () => {
    const event: GameEvent = { type: 'ENTITY_BUMPED', isFieldEvent: true, entityId: 'player', position: { x: 1, y: 1 }, dx: 1, dy: 0 };
    const nodes = entityBumpedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('BOUNCE');
  });
});

describe('itemDroppedBuilder', () => {
  it('creates ITEM_DROP step', () => {
    const event: GameEvent = {
      type: 'ITEM_DROPPED', isFieldEvent: true,
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
    const event: GameEvent = { type: 'DOOR_OPENED', isFieldEvent: true, position: { x: 1, y: 1 } };
    const nodes = doorOpenedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });

  it('creates UI_FLOATING_TEXT for DOOR_CLOSED', () => {
    const event: GameEvent = { type: 'DOOR_CLOSED', isFieldEvent: true, position: { x: 1, y: 1 } };
    const nodes = doorClosedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });
});

describe('entityHealedBuilder', () => {
  it('creates UI_FLOATING_TEXT with heal amount', () => {
    const event: GameEvent = { type: 'ENTITY_HEALED', isFieldEvent: true, entityId: 'player', amount: 10, newHp: 20, position: { x: 0, y: 0 } };
    const nodes = entityHealedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
    expect((nodes![0]!.step as any).text).toBe('+10');
  });
});


describe('status builders', () => {
  it('creates STATUS_BURST for STATUS_APPLIED', () => {
    const event: GameEvent = { type: 'STATUS_APPLIED', isFieldEvent: true, entityId: 'enemy1', sourceEntityId: null, effect: { type: 'poisoned', duration: 3, value: 2 } as any };
    const nodes = statusAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });

  it('creates STATUS_BURST for STATUS_TICKED', () => {
    const event: GameEvent = { type: 'STATUS_TICKED', isFieldEvent: true, entityId: 'enemy1', effectTypes: ['burning'], tags: ['status.burning'] };
    const nodes = statusTickedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });

  it('creates STATUS_BURST for STATUS_STACKS_ADJUSTED', () => {
    const event: GameEvent = { type: 'STATUS_STACKS_ADJUSTED', isFieldEvent: false, entityId: 'enemy1', statusType: 'poisoned', stacks: 2 };
    const nodes = statusStacksAdjustedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('STATUS_BURST');
  });

  it('creates UI_FLOATING_TEXT for STATUS_BLOCKED', () => {
    const event: GameEvent = { type: 'STATUS_BLOCKED', isFieldEvent: true, entityId: 'player', sourceEntityId: null, statusType: 'poisoned', blockedBy: 'counterattack' };
    const nodes = statusBlockedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });

  it('creates UI_FLOATING_TEXT for STATUS_REMOVED', () => {
    const event: GameEvent = { type: 'STATUS_REMOVED', isFieldEvent: true, entityId: 'player', effectType: 'poisoned' };
    const nodes = statusRemovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });
});

describe('entityCollidedBuilder', () => {
  it('creates TILE_SHAKE and PARTICLE_BURST for ENTITY_COLLIDED', () => {
    const event: GameEvent = {
      type: 'ENTITY_COLLIDED', isFieldEvent: true,
      entityId: 'player',
      targetId: null,
      collisionType: 'wall',
      sourceEntityId: null,
      position: { x: 2, y: 2 },
      dx: 1,
      dy: 0,
      tags: ['collision.wall'],
    };
    const nodes = entityCollidedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(2);
    const types = nodes!.map((n) => n.step.type);
    expect(types).toContain('TILE_SHAKE');
    expect(types).toContain('PARTICLE_BURST');
  });
});

describe('entityDisplacedBuilder', () => {
  it('creates MOVE step for ENTITY_DISPLACED without child MOVE', () => {
    const event: GameEvent = {
      type: 'ENTITY_DISPLACED', isFieldEvent: true,
      entityId: 'enemy1',
      sourceEntityId: null,
      from: { x: 3, y: 3 },
      to: { x: 4, y: 3 },
      dx: 1,
      dy: 0,
    };
    const nodes = entityDisplacedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('MOVE');
  });

  it('reuses child MOVE instead of duplicating animation', () => {
    const event: GameEvent = {
      type: 'ENTITY_DISPLACED', isFieldEvent: true,
      entityId: 'enemy1',
      sourceEntityId: null,
      from: { x: 3, y: 3 },
      to: { x: 4, y: 3 },
      dx: 1,
      dy: 0,
    };
    const childMove = { step: { type: 'MOVE' as const, entityId: 'enemy1', from: { x: 3, y: 3 }, to: { x: 4, y: 3 } }, children: [] };
    const nodes = entityDisplacedBuilder(event, [childMove], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBe(childMove);
  });
});

describe('tileEffect builders', () => {
  it('creates PARTICLE_BURST for TILE_EFFECT_CHANGED', () => {
    const event: GameEvent = { type: 'TILE_EFFECT_CHANGED', isFieldEvent: true, effectType: 'oil', position: { x: 2, y: 3 }, isNew: true };
    const nodes = tileEffectChangedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('PARTICLE_BURST');
    expect((nodes![0]!.step as any).x).toBe(2);
    expect((nodes![0]!.step as any).y).toBe(3);
    expect((nodes![0]!.step as any).color).toBe(0xcccccc);
  });

  it('creates PARTICLE_BURST for TILE_EFFECT_REMOVED', () => {
    const event: GameEvent = { type: 'TILE_EFFECT_REMOVED', isFieldEvent: true, effectType: 'oil', position: { x: 2, y: 3 } };
    const nodes = tileEffectRemovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('PARTICLE_BURST');
    expect((nodes![0]!.step as any).color).toBe(0x888888);
  });

  it('creates orange PARTICLE_BURST for TILE_EFFECT_STATUS_APPLIED', () => {
    const event: GameEvent = { type: 'TILE_EFFECT_STATUS_APPLIED', isFieldEvent: true, effectType: 'oil', statusType: 'burning', position: { x: 2, y: 3 }, duration: 3, sourceEntityId: null, isNew: true };
    const nodes = tileEffectStatusAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('PARTICLE_BURST');
    expect((nodes![0]!.step as any).color).toBe(0xffaa00);
  });

  it('uses the same status-applied color regardless of statusType', () => {
    const event: GameEvent = { type: 'TILE_EFFECT_STATUS_APPLIED', isFieldEvent: true, effectType: 'oil', statusType: 'frozen', position: { x: 2, y: 3 }, duration: 3, sourceEntityId: null, isNew: true };
    const nodes = tileEffectStatusAppliedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('PARTICLE_BURST');
    expect((nodes![0]!.step as any).color).toBe(0xffaa00);
  });

  it('creates PARTICLE_BURST for TILE_EFFECT_STATUS_REMOVED', () => {
    const event: GameEvent = { type: 'TILE_EFFECT_STATUS_REMOVED', isFieldEvent: true, effectType: 'oil', statusType: 'burning', position: { x: 2, y: 3 } };
    const nodes = tileEffectStatusRemovedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('PARTICLE_BURST');
    expect((nodes![0]!.step as any).color).toBe(0x888888);
  });

  it('returns null for mismatched event type', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', isFieldEvent: true, entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, movementType: 'walk' };
    expect(tileEffectChangedBuilder(event, [], makeMockState())).toBeNull();
    expect(tileEffectRemovedBuilder(event, [], makeMockState())).toBeNull();
    expect(tileEffectStatusAppliedBuilder(event, [], makeMockState())).toBeNull();
    expect(tileEffectStatusRemovedBuilder(event, [], makeMockState())).toBeNull();
  });
});

describe('tileExplodedBuilder', () => {
  it('creates EXPLOSION step for TILE_EXPLODED', () => {
    const event: GameEvent = {
      type: 'TILE_EXPLODED', isFieldEvent: true,
      position: { x: 2, y: 3 },
      sourceEntityId: null,
      damage: 5,
      radius: 1,
      tags: ['damage.magical.fire'],
    };
    const nodes = tileExplodedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('EXPLOSION');
    expect((nodes![0]!.step as any).center).toEqual({ x: 2, y: 3 });
    expect((nodes![0]!.step as any).radius).toBe(1);
  });

  it('uses event radius for explosion', () => {
    const event: GameEvent = {
      type: 'TILE_EXPLODED', isFieldEvent: true,
      position: { x: 5, y: 5 },
      sourceEntityId: null,
      damage: 8,
      radius: 2,
      tags: ['damage.magical.fire'],
    };
    const nodes = tileExplodedBuilder(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect((nodes![0]!.step as any).radius).toBe(2);
  });

  it('wraps child damage nodes inside explosion', () => {
    const childDamage = { step: { type: 'DAMAGE' as const, targetId: 'enemy1', amount: 5, tags: ['damage.magical.fire'], position: { x: 2, y: 3 } }, children: [] };
    const event: GameEvent = {
      type: 'TILE_EXPLODED', isFieldEvent: true,
      position: { x: 2, y: 3 },
      sourceEntityId: null,
      damage: 5,
      radius: 1,
      tags: ['damage.magical.fire'],
    };
    const nodes = tileExplodedBuilder(event, [childDamage], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('EXPLOSION');
    expect(nodes![0]!.children).toContain(childDamage);
  });

  it('returns null for mismatched event type', () => {
    const event: GameEvent = { type: 'ENTITY_MOVED', isFieldEvent: true, entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, movementType: 'walk' };
    expect(tileExplodedBuilder(event, [], makeMockState())).toBeNull();
  });
});
