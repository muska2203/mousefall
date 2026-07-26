import {describe, expect, it} from 'vitest';
import {
  ACTION_KEY_BINDINGS,
  DEFAULT_HOTBAR_SIZE,
  getHotbarIndexByKey,
  HOTBAR_INDEX_BY_KEY,
  HOTBAR_KEYS,
  HOTBAR_LABELS,
  INTERACTIVE_TAGS,
  KEY_MAP,
  matchesActionBinding,
} from '../../../../src/ui/input/keyboardConfig';

describe('keyboardConfig', () => {
  describe('KEY_MAP', () => {
    it('maps cardinal directions for arrows and both keyboard layouts', () => {
      expect(KEY_MAP.ArrowUp).toEqual([0, -1]);
      expect(KEY_MAP.w).toEqual([0, -1]);
      expect(KEY_MAP.W).toEqual([0, -1]);
      expect(KEY_MAP.ц).toEqual([0, -1]);
      expect(KEY_MAP.Ц).toEqual([0, -1]);

      expect(KEY_MAP.s).toEqual([0, 1]);
      expect(KEY_MAP.ы).toEqual([0, 1]);

      expect(KEY_MAP.a).toEqual([-1, 0]);
      expect(KEY_MAP.ф).toEqual([-1, 0]);

      expect(KEY_MAP.d).toEqual([1, 0]);
      expect(KEY_MAP.в).toEqual([1, 0]);
    });

    it('maps diagonal directions for QWE / ZXC layouts', () => {
      expect(KEY_MAP.q).toEqual([-1, -1]);
      expect(KEY_MAP.й).toEqual([-1, -1]);

      expect(KEY_MAP.e).toEqual([1, -1]);
      expect(KEY_MAP.у).toEqual([1, -1]);

      expect(KEY_MAP.z).toEqual([-1, 1]);
      expect(KEY_MAP.я).toEqual([-1, 1]);

      expect(KEY_MAP.c).toEqual([1, 1]);
      expect(KEY_MAP.с).toEqual([1, 1]);
    });
  });

  describe('INTERACTIVE_TAGS', () => {
    it('includes input, textarea and select', () => {
      expect(INTERACTIVE_TAGS.has('INPUT')).toBe(true);
      expect(INTERACTIVE_TAGS.has('TEXTAREA')).toBe(true);
      expect(INTERACTIVE_TAGS.has('SELECT')).toBe(true);
    });
  });

  describe('ACTION_KEY_BINDINGS', () => {
    it('defines bindings for all expected actions', () => {
      expect(Object.keys(ACTION_KEY_BINDINGS).sort()).toEqual([
        'cancelTargeting',
        'cycleInteraction',
        'endTurn',
        'interact',
        'toggleDebug',
      ]);
    });
  });

  describe('matchesActionBinding', () => {
    it('matches interact for latin and cyrillic keys', () => {
      expect(matchesActionBinding('interact', { key: 'f', code: 'KeyF' })).toBe(true);
      expect(matchesActionBinding('interact', { key: 'F', code: 'KeyF' })).toBe(true);
      expect(matchesActionBinding('interact', { key: 'а', code: 'KeyF' })).toBe(true);
      expect(matchesActionBinding('interact', { key: 'А', code: 'KeyF' })).toBe(true);
      expect(matchesActionBinding('interact', { key: 'x', code: 'KeyX' })).toBe(false);
    });

    it('matches cycle interaction on Tab', () => {
      expect(matchesActionBinding('cycleInteraction', { key: 'Tab', code: 'Tab' })).toBe(true);
      expect(matchesActionBinding('cycleInteraction', { key: 'Enter', code: 'Enter' })).toBe(false);
    });

    it('matches end turn on Space and legacy Spacebar', () => {
      expect(matchesActionBinding('endTurn', { key: ' ', code: 'Space' })).toBe(true);
      expect(matchesActionBinding('endTurn', { key: 'Spacebar', code: 'Space' })).toBe(true);
      expect(matchesActionBinding('endTurn', { key: 'Enter', code: 'Enter' })).toBe(false);
    });

    it('matches cancel targeting on Escape', () => {
      expect(matchesActionBinding('cancelTargeting', { key: 'Escape', code: 'Escape' })).toBe(true);
      expect(matchesActionBinding('cancelTargeting', { key: 'Enter', code: 'Enter' })).toBe(false);
    });

    it('matches toggle debug by key or code', () => {
      expect(matchesActionBinding('toggleDebug', { key: '`', code: 'Backquote' })).toBe(true);
      expect(matchesActionBinding('toggleDebug', { key: '~', code: 'Backquote' })).toBe(true);
      expect(matchesActionBinding('toggleDebug', { key: 'ё', code: 'Backquote' })).toBe(true);
      expect(matchesActionBinding('toggleDebug', { key: '', code: 'Backquote' })).toBe(true);
      expect(matchesActionBinding('toggleDebug', { key: '`', code: 'Digit1' })).toBe(true);
      expect(matchesActionBinding('toggleDebug', { key: '1', code: 'Digit1' })).toBe(false);
    });

    it('returns false for unknown actions', () => {
      expect(matchesActionBinding('unknown', { key: 'f', code: 'KeyF' })).toBe(false);
    });
  });

  describe('hotbar configuration', () => {
    it('HOTBAR_KEYS contains digits 1-9 then 0', () => {
      expect(HOTBAR_KEYS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    });

    it('HOTBAR_LABELS matches HOTBAR_KEYS', () => {
      expect(HOTBAR_LABELS).toEqual(HOTBAR_KEYS);
    });

    it('DEFAULT_HOTBAR_SIZE equals HOTBAR_KEYS length', () => {
      expect(DEFAULT_HOTBAR_SIZE).toBe(HOTBAR_KEYS.length);
    });

    it('HOTBAR_INDEX_BY_KEY maps keys to zero-based slot indices', () => {
      expect(HOTBAR_INDEX_BY_KEY['1']).toBe(0);
      expect(HOTBAR_INDEX_BY_KEY['9']).toBe(8);
      expect(HOTBAR_INDEX_BY_KEY['0']).toBe(9);
    });

    it('getHotbarIndexByKey returns expected indices or -1', () => {
      expect(getHotbarIndexByKey('1')).toBe(0);
      expect(getHotbarIndexByKey('9')).toBe(8);
      expect(getHotbarIndexByKey('0')).toBe(9);
      expect(getHotbarIndexByKey('a')).toBe(-1);
    });
  });
});
