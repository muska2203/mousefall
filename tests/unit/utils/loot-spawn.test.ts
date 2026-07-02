import { describe, it, expect } from 'vitest';
import { findFreeTileNear } from '../../../src/simulation/systems/loot-spawn';
import { makeGameState, makeStateWithEnemy, makeEnemy, makeFloorItemContainer } from '../../fixtures/gameState';

describe('findFreeTileNear', () => {
  it('возвращает origin, если клетка свободна', () => {
    const state = makeGameState();
    const pos = { x: 2, y: 2 };
    expect(findFreeTileNear(state, pos)).toEqual(pos);
  });

  it('находит соседнюю свободную клетку, если origin занята', () => {
    const state = makeGameState();
    // Игрок по умолчанию в (5,5) — эта клетка занята
    const origin = { x: 5, y: 5 };
    const result = findFreeTileNear(state, origin);
    // Ожидаем первую свободную клетку в кольце radius=1
    // Порядок обхода: dx=-1,dy=0 → (4,5); dx=0,dy=-1 → (5,4); dx=0,dy=1 → (5,6); dx=1,dy=0 → (6,5)
    expect(result).toEqual({ x: 4, y: 5 });
  });

  it('возвращает origin как fallback, если всё занято в пределах maxRadius', () => {
    const state = makeGameState();
    const origin = { x: 5, y: 5 }; // игрок
    // Заполним ВСЕ клетки в радиусе 2 entities, чтобы этап 1 ничего не нашёл
    const radius2Cells = [
      { x: 3, y: 5 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 6 }, { x: 5, y: 7 },
      { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 },
      { x: 7, y: 5 },
    ];
    radius2Cells.forEach((pos, i) => {
      const e = makeEnemy({ id: `fill_${i}`, x: pos.x, y: pos.y, blocksMovement: true });
      state.entities.set(e.id, e);
    });
    // Fallback на radius=1 тоже ничего не даст (все blocked)
    const result = findFreeTileNear(state, origin, 1);
    expect(result).toEqual(origin);
  });

  it('расширяет поиск на radius=2, если radius=1 полностью занят', () => {
    const state = makeGameState();
    // Игрок по умолчанию в (5,5). Добавим врагов во все соседние клетки,
    // чтобы radius=1 был полностью занят.
    const neighbors = [
      { x: 4, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
      { x: 6, y: 5 },
    ];
    neighbors.forEach((pos, i) => {
      const e = makeEnemy({ id: `block_${i}`, x: pos.x, y: pos.y, blocksMovement: true });
      state.entities.set(e.id, e);
    });

    const origin = { x: 5, y: 5 };
    const result = findFreeTileNear(state, origin, 2);
    // radius=2 кандидаты в порядке обхода:
    // dx=-2,dy=0 → (3,5) — первый свободный
    expect(result).toEqual({ x: 3, y: 5 });
  });

  it('учитывает maxRadius и возвращает origin, если ничего не найдено', () => {
    const state = makeGameState();
    const origin = { x: 2, y: 2 };
    // Заполняем origin и все клетки в радиусе 2 предметами (не блокируют)
    // чтобы этап 1 не нашёл полностью пустую клетку
    const cellsToFill: Array<{ x: number; y: number }> = [origin];
    for (let r = 1; r <= 2; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) === r) {
            cellsToFill.push({ x: origin.x + dx, y: origin.y + dy });
          }
        }
      }
    }
    cellsToFill.forEach((pos, i) => {
      const item = makeFloorItemContainer({ id: `fill_${i}`, x: pos.x, y: pos.y });
      state.entities.set(item.id, item);
    });
    // maxRadius=0: fallback не ищет вокруг, этап 1 на radius=0..2 не найдёт (всё занято items)
    // fallback на radius=0 вернёт origin, т.к. предмет не блокирует
    const result = findFreeTileNear(state, origin, 0);
    expect(result).toEqual(origin);
  });

  it('избегает клеток, занятых другими предметами', () => {
    const state = makeGameState();
    // Добавим предмет на (4,5) — первая кандидатная клетка при radius=1
    const item = makeFloorItemContainer({ x: 4, y: 5 });
    state.entities.set(item.id, item);

    // Игрок по умолчанию в (5,5) — origin занят
    const origin = { x: 5, y: 5 };
    const result = findFreeTileNear(state, origin);
    // (4,5) занят предметом, следующая свободная — (5,4)
    expect(result).toEqual({ x: 5, y: 4 });
  });

  it('возвращает origin, если на ней нет блокирующих сущностей и нет предмета', () => {
    const state = makeGameState();
    // origin (2,2) — пустая клетка
    const origin = { x: 2, y: 2 };
    const result = findFreeTileNear(state, origin);
    expect(result).toEqual(origin);
  });

  it('ищет соседнюю клетку, если origin занята предметом', () => {
    const state = makeGameState();
    const item = makeFloorItemContainer({ x: 2, y: 2 });
    state.entities.set(item.id, item);

    const origin = { x: 2, y: 2 };
    const result = findFreeTileNear(state, origin);
    expect(result).not.toEqual(origin);
  });

  it('fallback на клетку с мёртвым врагом, если в радиусе 2 нет полностью пустых', () => {
    const state = makeGameState();
    const deadEnemy = makeEnemy({ x: 2, y: 2, isAlive: false, blocksMovement: false });
    state.entities.set(deadEnemy.id, deadEnemy);
    // Заполним все соседние клетки в радиусе 2 блокирующими сущностями,
    // чтобы осталась только клетка с мёртвым врагом
    const surrounding = [
      { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 },
      { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 1 }, { x: 3, y: 3 },
      { x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 4 },
    ];
    surrounding.forEach((pos, i) => {
      const e = makeEnemy({ id: `surround_${i}`, x: pos.x, y: pos.y, blocksMovement: true });
      state.entities.set(e.id, e);
    });

    const origin = { x: 2, y: 2 };
    const result = findFreeTileNear(state, origin, 3);
    // В радиусе 2 нет полностью пустых → fallback на origin,
    // потому что мёртвый враг не блокирует
    expect(result).toEqual(origin);
  });

  it('выбирает полностью пустую клетку в радиусе 2 вместо клетки с мёртвым врагом', () => {
    const state = makeGameState();
    // Мёртвый враг на origin
    const deadEnemy = makeEnemy({ x: 2, y: 2, isAlive: false, blocksMovement: false });
    state.entities.set(deadEnemy.id, deadEnemy);
    // Пустая клетка на (1,2) в радиусе 1

    const origin = { x: 2, y: 2 };
    const result = findFreeTileNear(state, origin);
    // Должна выбраться (1,2), а не origin, потому что (1,2) полностью пустая
    expect(result).toEqual({ x: 1, y: 2 });
  });
});
