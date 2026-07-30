/**
 * Тесты слотов размещения объектов (фаза 4 слоистой модели клетки).
 *
 * Покрытие:
 * - `getPlacementSlot`: вывод слота из типа сущности (акторы → null).
 * - `canPlaceObjectAt`: все пары слотов — solid несовместим со всеми объектами,
 *   floorFixture несовместим с solid/floorFixture, loot совместим с floorFixture,
 *   но не стакуется со вторым loot; акторы не участвуют в проверке слотов.
 */

import { describe, it, expect } from 'vitest';
import { canPlaceObjectAt, getPlacementSlot } from '../../../src/simulation/state';
import {
  makeDoor,
  makeEnemy,
  makeFloorItemContainer,
  makeGameState,
  makePlayer,
  makePoi,
  makeProp,
  makeStairs,
} from '../../fixtures/gameState';
import type { Entity } from '../../../src/simulation/types';

const CELL = { x: 4, y: 4 };

function stateWith(entities: Entity[]) {
  return makeGameState({ entities: new Map(entities.map((e) => [e.id, e])) });
}

describe('getPlacementSlot', () => {
  it('дверь, проп и точка интереса — слот solid', () => {
    expect(getPlacementSlot(makeDoor())).toBe('solid');
    expect(getPlacementSlot(makeProp())).toBe('solid');
    expect(getPlacementSlot(makePoi())).toBe('solid');
  });

  it('лестница — слот floorFixture', () => {
    expect(getPlacementSlot(makeStairs('stairs_down'))).toBe('floorFixture');
  });

  it('контейнер лута — слот loot', () => {
    expect(getPlacementSlot(makeFloorItemContainer())).toBe('loot');
  });

  it('акторы не имеют слота размещения', () => {
    expect(getPlacementSlot(makePlayer())).toBeNull();
    expect(getPlacementSlot(makeEnemy())).toBeNull();
  });
});

describe('canPlaceObjectAt', () => {
  it('на пустой клетке можно разместить любой слот', () => {
    const state = stateWith([]);
    expect(canPlaceObjectAt(state, 'solid', CELL)).toBe(true);
    expect(canPlaceObjectAt(state, 'floorFixture', CELL)).toBe(true);
    expect(canPlaceObjectAt(state, 'loot', CELL)).toBe(true);
  });

  it('solid несовместим с любыми объектами на клетке', () => {
    expect(canPlaceObjectAt(stateWith([makeDoor(CELL)]), 'solid', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makeStairs('stairs_down', CELL)]), 'solid', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makeFloorItemContainer(CELL)]), 'solid', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makePoi(CELL)]), 'solid', CELL)).toBe(false);
  });

  it('solid не мешают акторы (проверка слотов их не касается)', () => {
    expect(canPlaceObjectAt(stateWith([makeEnemy(CELL)]), 'solid', CELL)).toBe(true);
  });

  it('floorFixture несовместим с solid и floorFixture, но совместим с loot', () => {
    expect(canPlaceObjectAt(stateWith([makeDoor(CELL)]), 'floorFixture', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makeStairs('stairs_down', CELL)]), 'floorFixture', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makeFloorItemContainer(CELL)]), 'floorFixture', CELL)).toBe(true);
  });

  it('loot совместим с floorFixture, но не стакуется со вторым loot и несовместим с solid', () => {
    expect(canPlaceObjectAt(stateWith([makeStairs('stairs_down', CELL)]), 'loot', CELL)).toBe(true);
    expect(canPlaceObjectAt(stateWith([makeFloorItemContainer(CELL)]), 'loot', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makeDoor(CELL)]), 'loot', CELL)).toBe(false);
    expect(canPlaceObjectAt(stateWith([makePoi(CELL)]), 'loot', CELL)).toBe(false);
  });

  it('объекты на других клетках не влияют на проверку', () => {
    const state = stateWith([makeDoor({ x: 6, y: 6 }), makeFloorItemContainer({ x: 7, y: 7 })]);
    expect(canPlaceObjectAt(state, 'solid', CELL)).toBe(true);
    expect(canPlaceObjectAt(state, 'loot', CELL)).toBe(true);
  });
});
