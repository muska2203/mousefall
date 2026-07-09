import { describe, expect, it } from 'vitest';
import { expandTag, expandTags } from '../../../../src/simulation/systems/tags/tag-hierarchy';

describe('tag-hierarchy', () => {
  describe('expandTag', () => {
    it('разворачивает иерархический тег attack.melee от конкретного к общему', () => {
      expect(expandTag('attack.melee')).toEqual(['attack.melee', 'attack']);
    });

    it('разворачивает трёхуровневый тег damage.physical.blunt', () => {
      expect(expandTag('damage.physical.blunt')).toEqual([
        'damage.physical.blunt',
        'damage.physical',
        'damage',
      ]);
    });

    it('возвращает сам тег, если в нём нет точек', () => {
      expect(expandTag('single')).toEqual(['single']);
    });

    it('возвращает пустой массив для пустой строки', () => {
      expect(expandTag('')).toEqual([]);
    });
  });

  describe('expandTags', () => {
    it('разворачивает массив из одного иерархического тега', () => {
      expect(expandTags(['attack.melee'])).toEqual(['attack.melee', 'attack']);
    });

    it('оставляет только уникальные теги при дублировании', () => {
      expect(expandTags(['attack.melee', 'attack'])).toEqual(['attack.melee', 'attack']);
    });

    it('разворачивает несколько иерархических тегов и удаляет общие префиксы-дубликаты', () => {
      expect(expandTags(['damage.physical.blunt', 'damage.physical.piercing'])).toEqual([
        'damage.physical.blunt',
        'damage.physical.piercing',
        'damage.physical',
        'damage',
      ]);
    });

    it('возвращает пустой массив для пустого входа', () => {
      expect(expandTags([])).toEqual([]);
    });
  });
});
