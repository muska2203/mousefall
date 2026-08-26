import { describe, it, expect } from 'vitest';
import { PlayerTemplateSchema } from '../../../src/content/schemas';
import { playerTemplates } from '../../../src/content/templates/players';

describe('Шаблоны игрока', () => {
  it('все шаблоны игроков валидируются и имеют корректную структуру', () => {
    expect(playerTemplates.length).toBeGreaterThan(0);

    for (const template of playerTemplates) {
      const parsed = PlayerTemplateSchema.parse(template);
      expect(typeof parsed.portraitImg).toBe('string');
      expect(parsed.placement).toBeUndefined();
      expect(typeof parsed.maxAp).toBe('number');
      expect(parsed.maxAp).toBeGreaterThan(0);
      expect(parsed.baseStats).toMatchObject({
        str: expect.any(Number),
        dex: expect.any(Number),
        int: expect.any(Number),
        vit: expect.any(Number),
      });
      expect(typeof parsed.isDefault).toBe('boolean');
    }
  });

  it('шаблон без baseStats получает значения по умолчанию', () => {
    const parsed = PlayerTemplateSchema.parse({
      id: 'test_hero',
      portraitImg: '/assets/portraits/test-ready.png',
    });

    expect(parsed.baseStats).toEqual({ str: 0, dex: 0, int: 0, vit: 0 });
    expect(parsed.isDefault).toBe(false);
  });

  it('шаблон без starterRelicPool получает пустой пул по умолчанию', () => {
    const parsed = PlayerTemplateSchema.parse({
      id: 'test_hero',
      portraitImg: '/assets/portraits/test-ready.png',
    });

    expect(parsed.starterRelicPool).toEqual([]);
  });

  it('шаблон с непустым starterRelicPool парсится и сохраняет порядок пула', () => {
    const parsed = PlayerTemplateSchema.parse({
      id: 'test_hero',
      portraitImg: '/assets/portraits/test-ready.png',
      starterRelicPool: ['relic_a', 'relic_b'],
    });

    expect(parsed.starterRelicPool).toEqual(['relic_a', 'relic_b']);
  });
});
