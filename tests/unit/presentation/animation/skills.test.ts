/**
 * Unit tests for skill animation composers.
 */

import {describe, expect, it} from 'vitest';
import {fireballComposer} from '../../../../src/presentation/animation/skills/fireball';
import {dashComposer} from '../../../../src/presentation/animation/skills/dash';
import {swoopComposer} from '../../../../src/presentation/animation/skills/swoop';
import type {GameEvent, GameState} from '../../../../src/simulation/types';
import type {AnimationNode} from '../../../../src/presentation/types';

type AbilityUsedEvent = Extract<GameEvent, { type: 'ABILITY_USED' }>;
type CastResolvedEvent = Extract<GameEvent, { type: 'CAST_RESOLVED' }>;

function makeMockState(): GameState {
  return {
    player: { id: 'player', x: 0, y: 0 } as any,
    entities: new Map(),
  } as unknown as GameState;
}

function makeNode(step: AnimationNode['step']): AnimationNode {
  return { step, children: [] };
}

describe('fireballComposer', () => {
  it('builds ABILITY_CAST → PROJECTILE → EXPLOSION chain', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'fireball',
      targets: [{ x: 3, y: 3 }],
      from: { x: 1, y: 1 },
    };
    const nodes = fireballComposer(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('ABILITY_CAST');
    expect(nodes![0]!.children[0]!.step.type).toBe('PROJECTILE');
    expect(nodes![0]!.children[0]!.children[0]!.step.type).toBe('EXPLOSION');
  });

  it('falls back to ABILITY_CAST without target', () => {
    const event: CastResolvedEvent = {
      type: 'CAST_RESOLVED',
      entityId: 'player',
      abilityId: 'fireball',
      targets: [],
      from: { x: 1, y: 1 },
    };
    const nodes = fireballComposer(event, [], makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('ABILITY_CAST');
  });
});

describe('dashComposer', () => {
  it('skips cast and sets fast MOVE duration', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
      from: { x: 5, y: 5 },
    };
    const children: AnimationNode[] = [
      makeNode({ type: 'MOVE', entityId: 'player', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } }),
      makeNode({ type: 'MOVE', entityId: 'player', from: { x: 6, y: 5 }, to: { x: 7, y: 5 } }),
    ];
    const nodes = dashComposer(event, children, makeMockState());

    // Composer работает изолированно; цепочка MOVE формируется treeBuilder через chainNodesByEntity.
    expect(nodes).toHaveLength(2);
    expect(nodes![0]!.step.type).toBe('MOVE');
    expect((nodes![0]!.step as any).duration).toBe(110);
    expect((nodes![0]!.step as any).sway).toBe(false);
    expect(nodes![1]!.step.type).toBe('MOVE');
    expect((nodes![1]!.step as any).duration).toBe(110);
    expect((nodes![1]!.step as any).sway).toBe(false);
  });

  it('attaches enemy push/damage to the collision MOVE', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
      from: { x: 5, y: 5 },
    };
    const children: AnimationNode[] = [
      makeNode({ type: 'MOVE', entityId: 'player', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } }),
      makeNode({ type: 'DAMAGE', targetId: 'enemy1', amount: 5, damageType: 'blunt', position: { x: 6, y: 5 } }),
      makeNode({ type: 'MOVE', entityId: 'enemy1', from: { x: 6, y: 5 }, to: { x: 7, y: 5 } }),
      makeNode({ type: 'MOVE', entityId: 'player', from: { x: 6, y: 5 }, to: { x: 7, y: 5 } }),
    ];
    const nodes = dashComposer(event, children, makeMockState());

    const firstMove = nodes![0]!;
    const childTypes = firstMove.children.map((c) => c.step.type);
    expect(childTypes).toContain('DAMAGE');
    expect(childTypes).toContain('MOVE');
  });

  it('attaches wall bounce to the last caster MOVE', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'dash',
      targets: [{ x: 6, y: 5 }],
      from: { x: 5, y: 5 },
    };
    const children: AnimationNode[] = [
      makeNode({ type: 'MOVE', entityId: 'player', from: { x: 5, y: 5 }, to: { x: 6, y: 5 } }),
      makeNode({ type: 'BOUNCE', entityId: 'player', x: 6, y: 5, dx: 1, dy: 0 }),
    ];
    const nodes = dashComposer(event, children, makeMockState());

    expect(nodes![0]!.step.type).toBe('MOVE');
    expect(nodes![0]!.children[0]!.step.type).toBe('BOUNCE');
  });
});

describe('swoopComposer', () => {
  it('builds JUMP with EXPLOSION and TILE_SHAKE on landing', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'swoop',
      targets: [{ x: 7, y: 5 }],
      from: { x: 5, y: 5 },
    };
    const children: AnimationNode[] = [
      makeNode({ type: 'JUMP', entityId: 'player', from: { x: 5, y: 5 }, to: { x: 7, y: 5 } }),
      makeNode({ type: 'DAMAGE', targetId: 'enemy1', amount: 8, damageType: 'blunt', position: { x: 7, y: 6 } }),
      makeNode({ type: 'MOVE', entityId: 'enemy1', from: { x: 7, y: 6 }, to: { x: 7, y: 7 } }),
    ];
    const nodes = swoopComposer(event, children, makeMockState());

    expect(nodes).toHaveLength(1);
    expect(nodes![0]!.step.type).toBe('JUMP');

    const childTypes = nodes![0]!.children.map((c) => c.step.type);
    expect(childTypes).toContain('EXPLOSION');
    expect(childTypes).toContain('TILE_SHAKE');
    expect(childTypes).toContain('DAMAGE');
    expect(childTypes).toContain('MOVE');
  });

  it('returns landing effects without caster jump', () => {
    const event: AbilityUsedEvent = {
      type: 'ABILITY_USED',
      entityId: 'player',
      abilityId: 'swoop',
      targets: [{ x: 7, y: 5 }],
      from: { x: 5, y: 5 },
    };
    const nodes = swoopComposer(event, [], makeMockState());

    const types = nodes!.map((n) => n.step.type);
    expect(types).toContain('EXPLOSION');
    expect(types).toContain('TILE_SHAKE');
  });
});
