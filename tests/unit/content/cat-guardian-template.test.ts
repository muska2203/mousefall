import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EntityTemplateSchema, ItemTemplateSchema } from '../../../src/content/schemas';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../${relativePath}`), 'utf-8'));
}

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
  it('валидируется как EntityTemplate и имеет ожидаемые характеристики', () => {
    const template = readJson('public/content/entities/enemies/cat_guardian.json');
    const parsed = EntityTemplateSchema.parse(template);

    expect(parsed.id).toBe('cat_guardian');
    expect(parsed.maxAp).toBe(3);
    expect(parsed.health.max).toBe(80);
    expect(parsed.baseStats).toEqual({ str: 6, dex: 2, int: 2, vit: 6 });
    expect(parsed.equipment).toEqual({ weapon: 'cat_guardian_maul', armor: 'cat_guardian_plate' });
    expect(parsed.abilities).toEqual([]);
    expect(parsed.xpReward).toBe(150);
    expect(parsed.renderScale).toBe(1.8);
  });

  it('имеет валидное оружие и броню', () => {
    const weapon = readJson('public/content/items/weapons/cat_guardian_maul.json');
    const armor = readJson('public/content/items/armor/cat_guardian_plate.json');

    const parsedWeapon = ItemTemplateSchema.parse(weapon);
    const parsedArmor = ItemTemplateSchema.parse(armor);

    expect(parsedWeapon.weapon?.baseDamage).toBe(8);
    expect(parsedWeapon.weapon?.damageType).toBe('blunt');
    expect(parsedArmor.armor?.baseArmor).toBe(6);
    expect(parsedArmor.equipModifiers.some(m => m.stat === 'maxHp')).toBe(true);
  });

  it('имеет спрайт 128×128', () => {
    const size = readPngSize('public/assets/enemies/cat_guardian.png');
    expect(size.width).toBe(128);
    expect(size.height).toBe(128);
  });
});
