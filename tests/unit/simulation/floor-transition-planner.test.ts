import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer } from '../../fixtures/gameState.ts';
import { computeFloorTransition } from '@simulation/systems/floor-transition-planner';
import type { DoorTemplate } from '@content/schemas';
import { initRegistry, resetRegistry } from '@content/registry';
import type { Entity, EntityId, StairsEntity } from '@simulation/types';

describe('computeFloorTransition', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate],
      ]),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('сохраняет текущий этаж в снапшот и возвращает план', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    state.explored[5]![5] = true;

    const plan = computeFloorTransition(state, 'down');

    expect(plan.from).toBe(1);
    expect(plan.to).toBe(2);
    expect(plan.direction).toBe('down');
    expect(state.floorSnapshots[0]).toBeDefined();
    expect(state.floorSnapshots[0]!.floor).toBe(1);
    expect(state.floorSnapshots[0]!.explored[5]![5]).toBe(true);

    expect(plan.map).toBeDefined();
    expect(plan.entities.has('player')).toBe(true);
    expect(plan.turn).toEqual({ activeSide: 'player', round: 1 });
  });

  it('генерирует новый этаж при отсутствии снапшота', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const oldMap = state.map;

    const plan = computeFloorTransition(state, 'down');

    expect(plan.map).not.toBe(oldMap);
    expect(plan.entities.size).toBeGreaterThan(1);
    expect(plan.explored.length).toBe(plan.map.height);
    expect(plan.explored[0]!.length).toBe(plan.map.width);
  });

  it('восстанавливает снапшот при возвращении на предыдущий этаж', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const originalMap = state.map;
    state.explored[5]![5] = true;

    const planDown = computeFloorTransition(state, 'down');
    state.floor = planDown.to;
    const planUp = computeFloorTransition(state, 'up');

    expect(planUp.to).toBe(1);
    expect(planUp.map).toBe(originalMap);
    expect(planUp.explored[5]![5]).toBe(true);
  });

  it('позиционирует игрока у противоположной лестницы', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });

    const plan = computeFloorTransition(state, 'down');

    const entities = plan.entities as Map<EntityId, Entity>;
    const stairsUp = Array.from(entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_up',
    );
    expect(stairsUp).toBeDefined();
    expect(plan.playerPosition).toEqual({ x: stairsUp!.x, y: stairsUp!.y });
  });

  it('не мутирует state.map и state.entities', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const oldMap = state.map;
    const oldEntities = state.entities;

    computeFloorTransition(state, 'down');

    expect(state.map).toBe(oldMap);
    expect(state.entities).toBe(oldEntities);
  });

  it('возвращает события FOV', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });

    const plan = computeFloorTransition(state, 'down');

    expect(Array.isArray(plan.fovEvents)).toBe(true);
  });
});
