import { describe, it, expect } from 'vitest';
import { createNewGameState } from '@simulation/state';
import { updateFOV, computeFOV } from '@simulation/systems/fov';
import { GameSimulation, defaultActionHandlerRegistry } from '@simulation/simulation';
import type { TileType, GameMap } from '@simulation/types';
import type { MapParams } from '@simulation/schemas/contentSchemas';

const testMapParams: MapParams = {
  id: 'test',
  width: 50,
  height: 50,
  minRooms: 2,
  maxRooms: 4,
  minRoomSize: 3,
  maxRoomSize: 5,
  enemyDensity: 0,
  itemDensity: 0,
  enemyPool: [],
  itemPool: [],
};

function makeFloorGrid(w: number, h: number): TileType[][] {
  return Array.from({ length: h }, () => Array(w).fill('floor'));
}

function makeWalledGrid(w: number, h: number): TileType[][] {
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) return 'wall';
      return 'floor';
    })
  );
}

function makeMap(width: number, height: number, tiles: TileType[][]): GameMap {
  return { width, height, tiles, rooms: [] };
}

describe('computeFOV', () => {
  it('возвращает видимые позиции из заданной точки', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 5, makeWalledGrid(5, 5));

    const visible = computeFOV(state, 2, 2, 8);

    const visibleSet = new Set(visible.map(p => `${p.x},${p.y}`));
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(visibleSet.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it('не включает клетки за стеной', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 3, [
      ['wall', 'wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall'],
    ]);

    const visible = computeFOV(state, 1, 1, 8);
    const visibleSet = new Set(visible.map(p => `${p.x},${p.y}`));

    expect(visibleSet.has('1,1')).toBe(true);
    expect(visibleSet.has('2,1')).toBe(true); // стена
    expect(visibleSet.has('3,1')).toBe(false); // за стеной
  });

  it('учитывает радиус', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(7, 7, makeWalledGrid(7, 7));

    const visible = computeFOV(state, 3, 3, 1);
    const visibleSet = new Set(visible.map(p => `${p.x},${p.y}`));

    expect(visibleSet.has('3,3')).toBe(true); // origin
    expect(visibleSet.has('3,2')).toBe(true); // N
    expect(visibleSet.has('4,3')).toBe(true); // E
    expect(visibleSet.has('3,4')).toBe(true); // S
    expect(visibleSet.has('2,3')).toBe(true); // W
    expect(visibleSet.has('2,2')).toBe(false);
    expect(visibleSet.has('4,4')).toBe(false);
    expect(visibleSet.has('1,1')).toBe(false);
    expect(visibleSet.has('5,5')).toBe(false);
  });
});

describe('updateFOV', () => {
  it('видит все клетки в пустой комнате в пределах радиуса', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 5, makeWalledGrid(5, 5));
    state.player.x = 2;
    state.player.y = 2;
    state.visible = Array.from({ length: 5 }, () => Array(5).fill(false));
    state.explored = Array.from({ length: 5 }, () => Array(5).fill(false));

    updateFOV(state);

    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(state.visible[y]![x]).toBe(true);
      }
    }
  });

  it('стена блокирует обзор за собой', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 3, [
      ['wall', 'wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall'],
    ]);
    state.player.x = 1;
    state.player.y = 1;
    state.visible = Array.from({ length: 3 }, () => Array(5).fill(false));
    state.explored = Array.from({ length: 3 }, () => Array(5).fill(false));

    updateFOV(state);

    expect(state.visible[1]![1]).toBe(true);
    expect(state.visible[1]![3]).toBe(false);
    expect(state.visible[1]![2]).toBe(true);
  });

  it('видит соседние стены вплотную, включая по диагонали', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(3, 3, [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall'],
    ]);
    state.player.x = 1;
    state.player.y = 1;
    state.visible = Array.from({ length: 3 }, () => Array(3).fill(false));
    state.explored = Array.from({ length: 3 }, () => Array(3).fill(false));

    updateFOV(state);

    expect(state.visible[1]![1]).toBe(true);
    expect(state.visible[0]![1]).toBe(true);
    expect(state.visible[1]![0]).toBe(true);
    expect(state.visible[1]![2]).toBe(true);
    expect(state.visible[2]![1]).toBe(true);
    expect(state.visible[0]![0]).toBe(true);
    expect(state.visible[0]![2]).toBe(true);
    expect(state.visible[2]![0]).toBe(true);
    expect(state.visible[2]![2]).toBe(true);
  });

  it('добавляет клетки в explored при первом видении', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(3, 3, makeWalledGrid(3, 3));
    state.player.x = 1;
    state.player.y = 1;
    state.visible = Array.from({ length: 3 }, () => Array(3).fill(false));
    state.explored = Array.from({ length: 3 }, () => Array(3).fill(false));

    const events = updateFOV(state);

    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('FOG_UPDATED');
    expect((events[0] as any).newlyVisible.length).toBeGreaterThan(0);

    const events2 = updateFOV(state);
    expect(events2.length).toBe(0);
  });

  it('сбрасывает visible, но не explored при обновлении', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(3, 3, makeWalledGrid(3, 3));
    state.player.x = 1;
    state.player.y = 1;
    state.visible = Array.from({ length: 3 }, () => Array(3).fill(false));
    state.explored = Array.from({ length: 3 }, () => Array(3).fill(false));

    updateFOV(state);
    expect(state.explored[1]![1]).toBe(true);

    state.player.x = 1;
    state.player.y = 1;
    updateFOV(state);

    expect(state.explored[1]![1]).toBe(true);
  });
});

describe('FOV в GameSimulation.dispatch', () => {
  it('порождает FOG_UPDATED в дереве событий при успешном ходе игрока', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 5, makeWalledGrid(5, 5));
    state.player.x = 2;
    state.player.y = 2;
    state.player.ap = 2;
    state.player.maxAp = 2;
    state.visible = Array.from({ length: 5 }, () => Array(5).fill(false));
    state.explored = Array.from({ length: 5 }, () => Array(5).fill(false));

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'MOVE', entityId: state.player.id, dx: 0, dy: 1 });

    expect(result.success).toBe(true);
    const root = result.phases[0]!.actions[0]!;
    const fovNodes = root.children.filter((c: any) => c.event.type === 'FOG_UPDATED');
    expect(fovNodes.length).toBe(1);
    expect(fovNodes[0]!.event.type).toBe('FOG_UPDATED');
  });

  it('не порождает FOG_UPDATED при неуспешном ходе', () => {
    const state = createNewGameState(123, testMapParams);
    state.map = makeMap(5, 5, makeWalledGrid(5, 5));
    state.player.x = 2;
    state.player.y = 2;
    state.player.ap = 0; // нет очков действия → ход не выполнится
    state.player.maxAp = 2;
    state.visible = Array.from({ length: 5 }, () => Array(5).fill(false));
    state.explored = Array.from({ length: 5 }, () => Array(5).fill(false));

    const sim = new GameSimulation(state, defaultActionHandlerRegistry());
    const result = sim.dispatch({ type: 'MOVE', entityId: state.player.id, dx: 0, dy: 1 });

    expect(result.success).toBe(false);
    const root = result.phases[0]!.actions[0]!;
    const fovNodes = root.children.filter((c: any) => c.event.type === 'FOG_UPDATED');
    expect(fovNodes.length).toBe(0);
  });
});
