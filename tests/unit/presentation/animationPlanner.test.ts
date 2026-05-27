/**
 * Unit tests for animationPlanner.
 */

import {describe, expect, it} from 'vitest';
import {buildAnimationTree, registerAnimationBuilder} from '../../../src/presentation/animationPlanner';
import type {ExecutionNode} from '../../../src/simulation/systems/actions/types';
import type {SimulationResult, GameEvent, GameState} from '../../../src/simulation/types';

function makeExecNode(event: GameEvent, children: ExecutionNode[] = []): ExecutionNode {
  return { event, parent: null, children };
}

function makeResult(actions: ExecutionNode[]): SimulationResult {
  return { success: true, stateChanged: true, phases: [{ side: 'PLAYER', actions }] };
}

function makeResultWithPhases(phases: { side: 'PLAYER' | 'ENVIRONMENT' | 'STATUS_TICK'; actions: ExecutionNode[] }[]): SimulationResult {
  return { success: true, stateChanged: true, phases: phases as any };
}

/** Минимальный mock state, где все клетки видимы (чтобы FOV-фильтр не влиял на тесты). */
function makeMockState(): GameState {
  const width = 10;
  const height = 10;
  return {
    map: { width, height, tiles: [], rooms: [] },
    visible: Array.from({ length: height }, () => Array(width).fill(true)),
    explored: Array.from({ length: height }, () => Array(width).fill(true)),
    entities: new Map([['player', { id: 'player', x: 0, y: 0 } as any]]),
    player: { id: 'player', x: 0, y: 0 } as any,
    mapParams: {} as any,
    turn: { activeSide: 'PLAYER', round: 1 } as any,
    phase: 'playing' as any,
    floor: 1,
    floorSnapshots: [],
    rng: { seed: 1, state: 1 },
    nextEntityCounter: 0,
  } as unknown as GameState;
}

describe('buildAnimationTree', () => {
  it('converts ENTITY_MOVED to MOVE step', () => {
    const node = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('MOVE');
    expect(tree[0]![0]!.children).toHaveLength(0);
  });

  it('converts ACTION_APPLIED (ATTACK) to ATTACK step', () => {
    const node = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('ATTACK');
  });

  it('converts ENTITY_DAMAGED to DAMAGE step', () => {
    const node = makeExecNode({ type: 'ENTITY_DAMAGED', targetId: 'enemy1', damage: 5, position: { x: 3, y: 3 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('DAMAGE');
  });

  it('preserves parent-child structure', () => {
    const child = makeExecNode({ type: 'ENTITY_DIED', entityId: 'enemy1', position: { x: 2, y: 2 } });
    const parent = makeExecNode({ type: 'ENTITY_DAMAGED', targetId: 'enemy1', damage: 5, position: { x: 2, y: 2 } }, [child]);
    const result = makeResult([parent]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('DAMAGE');
    expect(tree[0]![0]!.children).toHaveLength(1);
    expect(tree[0]![0]!.children[0]!.step.type).toBe('DEATH');
  });

  it('flattens up non-animated nodes', () => {
    // ACTION_APPLIED не имеет builder — должен раствориться
    const child = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const parent = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } }, [child]);
    const result = makeResult([parent]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('MOVE');
  });

  it('converts ITEM_DROPPED to ITEM_DROP step with from and position', () => {
    const node = makeExecNode({
      type: 'ITEM_DROPPED',
      dropperEntityId: 'enemy1',
      itemInstanceId: 'item_1',
      templateId: 'health_potion',
      position: { x: 3, y: 3 },
      from: { x: 2, y: 2 },
    });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    const step = tree[0]![0]!.step as any;
    expect(step.type).toBe('ITEM_DROP');
    expect(step.itemId).toBe('item_1');
    expect(step.position).toEqual({ x: 3, y: 3 });
    expect(step.from).toEqual({ x: 2, y: 2 });
    expect(step.templateId).toBe('health_potion');
  });

  it('converts ABILITY_USED to ABILITY_CAST step', () => {
    const node = makeExecNode({ type: 'ABILITY_USED', entityId: 'player', abilityId: 'magic_slap', targets: [{ x: 3, y: 3 }], from: { x: 1, y: 1 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('ABILITY_CAST');
    expect((tree[0]![0]!.step as any).entityId).toBe('player');
    expect((tree[0]![0]!.step as any).abilityId).toBe('magic_slap');
    expect((tree[0]![0]!.step as any).targets).toEqual([{ x: 3, y: 3 }]);
    expect((tree[0]![0]!.step as any).from).toEqual({ x: 1, y: 1 });
  });

  it('expands fireball into ABILITY_CAST → PROJECTILE → EXPLOSION chain', () => {
    const node = makeExecNode({ type: 'ABILITY_USED', entityId: 'player', abilityId: 'fireball', targets: [{ x: 3, y: 3 }], from: { x: 1, y: 1 } });
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('ABILITY_CAST');
    expect(tree[0]![0]!.children).toHaveLength(1);
    expect(tree[0]![0]!.children[0]!.step.type).toBe('PROJECTILE');
    expect(tree[0]![0]!.children[0]!.children).toHaveLength(1);
    expect(tree[0]![0]!.children[0]!.children[0]!.step.type).toBe('EXPLOSION');
  });

  it('supports custom builders via registerAnimationBuilder', () => {
    registerAnimationBuilder('CUSTOM_EVENT', (event, children) => {
      if ((event as any).type !== 'CUSTOM_EVENT') return null;
      return [{ step: { type: 'UI_FLOATING_TEXT', text: 'hello', x: 0, y: 0, styleKey: 'default' }, children }];
    });

    const node = makeExecNode({ type: 'CUSTOM_EVENT' } as unknown as GameEvent);
    const result = makeResult([node]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('UI_FLOATING_TEXT');
  });

  it('merges PLAYER and ENVIRONMENT phases when first player action is MOVE', () => {
    const playerMove = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } }, [
      makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }),
    ]);
    const enemyMove = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'enemy1', from: { x: 5, y: 5 }, to: { x: 4, y: 5 } });
    const result = makeResultWithPhases([
      { side: 'PLAYER', actions: [playerMove] },
      { side: 'ENVIRONMENT', actions: [enemyMove] },
    ]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(1);
    expect(tree[0]!).toHaveLength(2);
    expect(tree[0]![0]!.step.type).toBe('MOVE');
    expect(tree[0]![1]!.step.type).toBe('MOVE');
  });

  it('keeps PLAYER and ENVIRONMENT sequential when first player action is ATTACK', () => {
    const playerAttack = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 } });
    const enemyMove = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'enemy1', from: { x: 5, y: 5 }, to: { x: 4, y: 5 } });
    const result = makeResultWithPhases([
      { side: 'PLAYER', actions: [playerAttack] },
      { side: 'ENVIRONMENT', actions: [enemyMove] },
    ]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(2);
    expect(tree[0]!).toHaveLength(1);
    expect(tree[0]![0]!.step.type).toBe('ATTACK');
    expect(tree[1]!).toHaveLength(1);
    expect(tree[1]![0]!.step.type).toBe('MOVE');
  });

  it('keeps STATUS_TICK as separate phase after merged PLAYER+ENVIRONMENT', () => {
    const playerMove = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'MOVE', entityId: 'player', dx: 1, dy: 0 } }, [
      makeExecNode({ type: 'ENTITY_MOVED', entityId: 'player', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }),
    ]);
    const enemyMove = makeExecNode({ type: 'ENTITY_MOVED', entityId: 'enemy1', from: { x: 5, y: 5 }, to: { x: 4, y: 5 } });
    const tick = makeExecNode({ type: 'ENTITY_DAMAGED', targetId: 'player', damage: 1, position: { x: 0, y: 0 } });
    const result = makeResultWithPhases([
      { side: 'PLAYER', actions: [playerMove] },
      { side: 'ENVIRONMENT', actions: [enemyMove] },
      { side: 'STATUS_TICK', actions: [tick] },
    ]);
    const tree = buildAnimationTree(result, makeMockState());

    expect(tree).toHaveLength(2);
    expect(tree[0]!).toHaveLength(2); // PLAYER + ENVIRONMENT merged
    expect(tree[1]!).toHaveLength(1); // STATUS_TICK separate
    expect(tree[1]![0]!.step.type).toBe('DAMAGE');
  });
});
