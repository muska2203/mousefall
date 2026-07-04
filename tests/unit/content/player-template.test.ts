import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PlayerTemplateSchema } from '../../../src/content/schemas';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../${relativePath}`), 'utf-8'));
}

function listPlayerTemplates(): Array<{ id: string; parsed: ReturnType<typeof PlayerTemplateSchema.parse> }> {
  const dir = path.resolve(__dirname, '../../../public/content/entities/player');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const parsed = PlayerTemplateSchema.parse(readJson(`public/content/entities/player/${f}`));
      return { id: path.basename(f, '.json'), parsed };
    });
}

describe('Шаблоны игрока', () => {
  it('все шаблоны игроков валидируются и имеют корректную структуру', () => {
    const templates = listPlayerTemplates();
    expect(templates.length).toBeGreaterThan(0);

    for (const { id, parsed } of templates) {
      expect(parsed.id).toBe(id);
      expect(typeof parsed.portraitImg).toBe('string');
      expect(typeof parsed.renderScale).toBe('number');
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
});
