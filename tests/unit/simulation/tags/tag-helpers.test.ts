import { describe, expect, it } from 'vitest';
import { hasTag, hasAllTags, hasAnyTag } from '../../../../src/simulation/systems/tags/tag-helpers';

describe('tag-helpers', () => {
  describe('hasTag', () => {
    it('возвращает true, если тег присутствует в массиве', () => {
      expect(hasTag(['attack.melee', 'target.single'], 'attack.melee')).toBe(true);
    });

    it('возвращает false, если тег отсутствует в массиве', () => {
      expect(hasTag(['attack.melee', 'target.single'], 'attack.ranged')).toBe(false);
    });

    it('возвращает false для пустого массива', () => {
      expect(hasTag([], 'attack.melee')).toBe(false);
    });
  });

  describe('hasAllTags', () => {
    it('возвращает true, если все теги из списка присутствуют', () => {
      expect(hasAllTags(['attack.melee', 'target.single', 'delivery.weapon'], ['attack.melee', 'target.single'])).toBe(true);
    });

    it('возвращает false, если хотя бы одного тега не хватает', () => {
      expect(hasAllTags(['attack.melee', 'target.single'], ['attack.melee', 'delivery.weapon'])).toBe(false);
    });

    it('возвращает true для пустого списка required', () => {
      expect(hasAllTags(['attack.melee'], [])).toBe(true);
    });

    it('возвращает false, если тегов в массиве меньше, чем required', () => {
      expect(hasAllTags(['attack.melee'], ['attack.melee', 'target.single'])).toBe(false);
    });
  });

  describe('hasAnyTag', () => {
    it('возвращает true, если хотя бы один тег из списка присутствует', () => {
      expect(hasAnyTag(['attack.melee', 'target.single'], ['attack.ranged', 'attack.melee'])).toBe(true);
    });

    it('возвращает false, если ни один тег не совпал', () => {
      expect(hasAnyTag(['attack.melee', 'target.single'], ['attack.ranged', 'target.aoe'])).toBe(false);
    });

    it('возвращает false для пустого списка candidates', () => {
      expect(hasAnyTag(['attack.melee'], [])).toBe(false);
    });

    it('возвращает false для пустого массива тегов', () => {
      expect(hasAnyTag([], ['attack.melee'])).toBe(false);
    });
  });
});
