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
  nextStepToward,
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

  describe('nextStepToward', () => {
    it('returns next step via BFS', () => {
      const step = nextStepToward(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        () => true,
      );
      expect(step).toEqual({ x: 1, y: 0 });
    });

    it('returns null when destination is same as start', () => {
      const step = nextStepToward(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        () => true,
      );
      expect(step).toBeNull();
    });

    it('returns null when blocked and maxSteps exceeded', () => {
      const step = nextStepToward(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        () => false,
        5,
      );
      expect(step).toBeNull();
    });

    it('supports diagonal movement with allowDiagonal flag', () => {
      // С диагоналями: соседняя диагональная клетка доступна сразу
      const stepDiag = nextStepToward(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        () => true,
        20,
        true,
      );
      expect(stepDiag).toEqual({ x: 1, y: 1 });

      // Без диагоналей: до (1,1) пойдём либо через (1,0), либо через (0,1)
      const stepStraight = nextStepToward(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        () => true,
        20,
        false,
      );
      expect(stepStraight).not.toBeNull();
      expect(stepStraight).not.toEqual({ x: 1, y: 1 });
    });
  });
});
