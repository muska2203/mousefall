import { describe, it, expect } from 'vitest';
import { EntityTemplateSchema, ItemTemplateSchema } from '../../../src/content/schemas';
import { catGuardian } from '../../../src/content/templates/entities/cat-guardian';
import { catGuardianMaul } from '../../../src/content/templates/items/weapons/cat-guardian-maul';
import { catGuardianPlate } from '../../../src/content/templates/items/armor/cat-guardian-plate';

// Тест проверяет только структуру шаблонов (Zod-валидация и форма полей).
// Конкретные значения полей (масштаб спрайта, статы, размеры PNG) здесь не
// assert'ятся — корректность данных охраняет scripts/validate-content.ts.

describe('Шаблон босса cat_guardian', () => {
  it('валидируется как EntityTemplate и имеет корректную структуру', () => {
    const parsed = EntityTemplateSchema.parse(catGuardian);

    expect(parsed.id).toBe('cat_guardian');
    // Босс первого этажа — допустим в bossPool карты (roadMap 1.3).
    expect(parsed.isBoss).toBe(true);
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
    // Прямые статы вместо экипировки: профиль атаки, броня и модификаторы шаблона.
    expect(parsed.attack.damage).toMatchObject({
      min: expect.any(Number),
      max: expect.any(Number),
    });
    expect(parsed.attack.damageDistribution.length).toBeGreaterThan(0);
    expect(parsed.attack.tags).toContain('attack.melee');
    expect(typeof parsed.armor).toBe('number');
    expect(parsed.armor).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(parsed.modifiers)).toBe(true);
    expect(parsed.modifiers.every((id) => typeof id === 'string')).toBe(true);
    expect(Array.isArray(parsed.abilities)).toBe(true);
  });

  it('имеет валидное оружие и броню с корректной структурой', () => {
    const parsedWeapon = ItemTemplateSchema.parse(catGuardianMaul);
    const parsedArmor = ItemTemplateSchema.parse(catGuardianPlate);

    expect(parsedWeapon.type).toBe('weapon');
    expect(parsedWeapon.weapon).toBeDefined();
    expect(typeof parsedWeapon.weapon?.damage.min).toBe('number');
    expect(typeof parsedWeapon.weapon?.damage.max).toBe('number');
    expect(parsedWeapon.weapon?.damageDistribution).toBeInstanceOf(Array);
    expect(parsedWeapon.weapon?.damageDistribution.length).toBeGreaterThan(0);
    expect(typeof parsedWeapon.weapon?.damageDistribution[0]?.damageTag).toBe('string');

    expect(parsedArmor.type).toBe('armor');
    expect(parsedArmor.armor).toBeDefined();
    expect(typeof parsedArmor.armor?.baseArmor).toBe('number');
    // Фирменное свойство лат стражника — модификатор mod_guardian_vitality.
    expect(parsedArmor.fixedModifiers).toContain('mod_guardian_vitality');
  });
});
