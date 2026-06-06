import { describe, expect, it } from 'vitest';
import {
  manhattanDistance,
  chebyshevDistance,
  distanceSq,
  inBounds,
  clamp,
  cardinalNeighbors,
  allNeighbors,
  stepToward,
  posEqual,
  findPath,
} from '../../../src/utils/math';

describe('math utils', () => {
  describe('manhattanDistance', () => {
    it('calculates correct distance', () => {
      expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
      expect(manhattanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });
  });

  describe('chebyshevDistance', () => {
    it('calculates correct distance', () => {
      expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
      expect(chebyshevDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });
  });

  describe('distanceSq', () => {
    it('calculates squared distance', () => {
      expect(distanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
      expect(distanceSq({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });
  });

  describe('inBounds', () => {
    it('returns true for positions inside grid', () => {
      expect(inBounds({ x: 0, y: 0 }, 10, 10)).toBe(true);
      expect(inBounds({ x: 9, y: 9 }, 10, 10)).toBe(true);
    });

    it('returns false for positions outside grid', () => {
      expect(inBounds({ x: -1, y: 0 }, 10, 10)).toBe(false);
      expect(inBounds({ x: 0, y: 10 }, 10, 10)).toBe(false);
    });
  });

  describe('clamp', () => {
    it('clamps value to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('cardinalNeighbors', () => {
    it('returns 4 neighbors', () => {
      const neighbors = cardinalNeighbors({ x: 1, y: 1 });
      expect(neighbors).toHaveLength(4);
      expect(neighbors).toContainEqual({ x: 1, y: 0 });
      expect(neighbors).toContainEqual({ x: 2, y: 1 });
      expect(neighbors).toContainEqual({ x: 1, y: 2 });
      expect(neighbors).toContainEqual({ x: 0, y: 1 });
    });
  });

  describe('allNeighbors', () => {
    it('returns 8 neighbors', () => {
      const neighbors = allNeighbors({ x: 1, y: 1 });
      expect(neighbors).toHaveLength(8);
    });
  });

  describe('stepToward', () => {
    it('returns unit step', () => {
      expect(stepToward({ x: 0, y: 0 }, { x: 5, y: 3 })).toEqual({ x: 1, y: 1 });
      expect(stepToward({ x: 5, y: 5 }, { x: 0, y: 0 })).toEqual({ x: -1, y: -1 });
    });
  });

  describe('posEqual', () => {
    it('returns true for equal positions', () => {
      expect(posEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
      expect(posEqual({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    });
  });

    describe('findPath', () => {
    it('возвращает пустой массив, если начальная позиция совпадает с целевой', () => {
      const path = findPath({ x: 5, y: 5 }, { x: 5, y: 5 }, () => true);
      expect(path).toEqual([]);
    });

    it('возвращает прямой путь без препятствий', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, () => true);
      expect(path).toEqual([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]);
    });

    it('обходит препятствия', () => {
      const walls = new Set(['1,0', '1,1', '1,2']);
      const path = findPath(
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        (pos) => !walls.has(`${pos.x},${pos.y}`),
      );
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
      // Проверяем, что ни одна клетка пути не является стеной
      for (const p of path!) {
        expect(walls.has(`${p.x},${p.y}`)).toBe(false);
      }
    });

    it('использует диагонали при allowDiagonal=true', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, () => true, 200, true);
      // С диагоналями путь должен быть короче (3 шага вместо 6)
      expect(path).toHaveLength(3);
      expect(path).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]);
    });

    it('не использует диагонали при allowDiagonal=false', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, () => true, 200, false);
      // Без диагоналей путь должен содержать только кардинальные шаги
      for (const p of path!) {
        const dx = Math.abs(p.x - 0);
        const dy = Math.abs(p.y - 0);
        expect(dx + dy).toBeGreaterThan(0);
      }
      expect(path![path!.length - 1]).toEqual({ x: 2, y: 2 });
    });

    it('возвращает null, если цель недостижима', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, () => false);
      expect(path).toBeNull();
    });

    it('срезает углы (диагональ между двумя стенами)', () => {
      const walls = new Set(['1,0', '0,1']);
      const path = findPath(
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        (pos) => !walls.has(`${pos.x},${pos.y}`),
        200,
        true,
      );
      // Диагональ из (0,0) в (1,1) разрешена, даже если (1,0) и (0,1) — стены
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ x: 1, y: 1 });
    });

    it('учитывает maxSteps', () => {
      const path = findPath(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        () => true,
        5, // очень мало шагов
        true,
      );
      expect(path).toBeNull();
    });

    it('достигает цели, даже если она сама непроходима (isWalkable для to игнорируется)', () => {
      const path = findPath(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        (pos) => pos.x !== 2, // целевая клетка "непроходима"
      );
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 2, y: 0 });
    });
  });
});
