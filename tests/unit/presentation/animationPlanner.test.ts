/**
 * Unit tests for animationPlanner.
 */

import {describe, expect, it} from 'vitest';
import {buildAnimationTree, registerAnimationBuilder} from '../../../src/presentation/animationPlanner';
import type {ExecutionNode} from '../../../src/simulation/systems/actions/types';
import type {SimulationResult, GameEvent} from '../../../src/simulation/types';

function makeExecNode(event: GameEvent, children: ExecutionNode[] = []): ExecutionNode {
  return { event, parent: null, children };
}

function makeResult(actions: ExecutionNode[]): SimulationResult {
  return { success: true, stateChanged: true, phases: [{ side: 'PLAYER', actions }] };
}

describe('buildAnimationTree', () => {
  it('converts ENTITY_MOVED to MOVE step', () => {
    const node = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('MOVE');
    expect(tree[0]!.children).toHaveLength(0);
  });

  it('converts ENTITY_ATTACKED to ATTACK step', () => {
    const node = makeExecNode({ type: 'ENTITY_ATTACKED', attackerId: 'player', dx: 1, dy: 0 });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('ATTACK');
  });

  it('converts ENTITY_DAMAGED to DAMAGE step', () => {
    const node = makeExecNode({ type: 'ENTITY_DAMAGED', targetId: 'enemy1', damage: 5, position: { x: 3, y: 3 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('DAMAGE');
  });

  it('preserves parent-child structure', () => {
    const child = makeExecNode({ type: 'ENTITY_DIED', entityId: 'enemy1', position: { x: 2, y: 2 } });
    const parent = makeExecNode({ type: 'ENTITY_DAMAGED', targetId: 'enemy1', damage: 5, position: { x: 2, y: 2 } }, [child]);
    const result = makeResult([parent]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('DAMAGE');
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.step.type).toBe('DEATH');
  });

  it('flattens up non-animated nodes', () => {
    // ACTION_APPLIED не имеет builder — должен раствориться
    const child = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const parent = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } }, [child]);
    const result = makeResult([parent]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('MOVE');
  });

  it('supports custom builders via registerAnimationBuilder', () => {
    registerAnimationBuilder('CUSTOM_EVENT', (event) => {
      if ((event as any).type !== 'CUSTOM_EVENT') return null;
      return { type: 'UI_FLOATING_TEXT', text: 'hello', x: 0, y: 0, styleKey: 'default' };
    });

    const node = makeExecNode({ type: 'CUSTOM_EVENT' } as unknown as GameEvent);
    const result = makeResult([node]);
    const tree = buildAnimationTree(result);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.step.type).toBe('UI_FLOATING_TEXT');
  });
});
