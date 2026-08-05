import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EntityTemplateSchema, ItemTemplateSchema } from '../../../src/content/schemas';
import { catGuardian } from '../../../src/content/templates/entities/cat-guardian';
import { catGuardianMaul } from '../../../src/content/templates/items/weapons/cat-guardian-maul';
import { catGuardianPlate } from '../../../src/content/templates/items/armor/cat-guardian-plate';

function readPngSize(relativePath: string) {
  const buf = fs.readFileSync(path.resolve(__dirname, `../../../${relativePath}`));
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
    throw new Error(`Файл ${relativePath} не является PNG`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe('Шаблон босса cat_guardian', () => {
  it('валидируется как EntityTemplate и имеет корректную структуру', () => {
    const parsed = EntityTemplateSchema.parse(catGuardian);

    expect(parsed.id).toBe('cat_guardian');
    expect(typeof parsed.maxAp).toBe('number');
    expect(parsed.maxAp).toBeGreaterThan(0);
    expect(typeof parsed.health.max).toBe('number');
    expect(parsed.health.max).toBeGreaterThan(0);
    expect(parsed.baseStats).toMatchObject({
      str: expect.any(Number),
      dex: expect.any(Number),
      int: expect.any(Number),
      vit: expect.any(Number),
    });
    expect(parsed.equipment).toMatchObject({
      weapon: expect.any(String),
      armor: expect.any(String),
    });
    expect(Array.isArray(parsed.abilities)).toBe(true);
    expect(typeof parsed.renderScale).toBe('number');
  });

  it('имеет валидное оружие и броню с корректной структурой', () => {
    const parsedWeapon = ItemTemplateSchema.parse(catGuardianMaul);
    const parsedArmor = ItemTemplateSchema.parse(catGuardianPlate);

    expect(parsedWeapon.type).toBe('weapon');
    expect(parsedWeapon.weapon).toBeDefined();
    expect(typeof parsedWeapon.weapon?.baseDamage).toBe('number');
    expect(parsedWeapon.weapon?.damageDistribution).toBeInstanceOf(Array);
    expect(parsedWeapon.weapon?.damageDistribution.length).toBeGreaterThan(0);
    expect(typeof parsedWeapon.weapon?.damageDistribution[0]?.damageTag).toBe('string');

    expect(parsedArmor.type).toBe('armor');
    expect(parsedArmor.armor).toBeDefined();
    expect(typeof parsedArmor.armor?.baseArmor).toBe('number');
    expect(parsedArmor.equipModifiers.some(m => m.stat === 'maxHp')).toBe(true);
  });

  it('имеет спрайт 128×128', () => {
    const size = readPngSize('public/assets/enemies/cat_guardian.png');
    expect(size.width).toBe(128);
    expect(size.height).toBe(128);
  });
});
