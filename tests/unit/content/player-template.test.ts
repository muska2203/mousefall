import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PlayerTemplateSchema } from '../../../src/content/schemas';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../${relativePath}`), 'utf-8'));
}

describe('Шаблоны игрока', () => {
  it('witcher валидируется и имеет стартовые характеристики силы и выносливости по 4', () => {
    const template = readJson('public/content/entities/player/witcher.json');
    const parsed = PlayerTemplateSchema.parse(template);

    expect(parsed.id).toBe('witcher');
    expect(parsed.baseStats).toEqual({ str: 4, dex: 2, int: 0, vit: 4 });
    expect(parsed.isDefault).toBe(true);
    expect(parsed.portraitImg).toBe('/assets/portraits/witcher-ready.png');
    expect(parsed.maxAp).toBe(3);
  });

  it('шаблон без baseStats получает значения по умолчанию', () => {
    const parsed = PlayerTemplateSchema.parse({
      id: 'test_hero',
      portraitImg: '/assets/portraits/test-ready.png',
    });

    expect(parsed.baseStats).toEqual({ str: 0, dex: 0, int: 0, vit: 0 });
    expect(parsed.isDefault).toBe(false);
  });

  it('orc-barbarian валидируется с нулевыми стартовыми характеристиками по умолчанию', () => {
    const template = readJson('public/content/entities/player/orc-barbarian.json');
    const parsed = PlayerTemplateSchema.parse(template);

    expect(parsed.id).toBe('orc-barbarian');
    expect(parsed.baseStats).toEqual({ str: 0, dex: 0, int: 0, vit: 0 });
    expect(parsed.isDefault).toBe(false);
  });
});
