import { describe, expect, it } from 'vitest';
import { ruContentTexts } from '../../../src/content/texts/ru';
import { enContentTexts } from '../../../src/content/texts/en';

describe('Тексты способности sudden_strike', () => {
  it('ruContentTexts содержит sudden_strike с названием и описанием', () => {
    const ability = ruContentTexts.abilities.sudden_strike;
    expect(ability).toBeDefined();
    if (!ability) throw new Error('sudden_strike отсутствует в ruContentTexts.abilities');
    expect(typeof ability.name).toBe('string');
    expect(ability.name.length).toBeGreaterThan(0);
    expect(typeof ability.description).toBe('string');
    expect((ability.description ?? '').length).toBeGreaterThan(0);
  });

  it('enContentTexts содержит sudden_strike с названием и описанием', () => {
    const ability = enContentTexts.abilities.sudden_strike;
    expect(ability).toBeDefined();
    if (!ability) throw new Error('sudden_strike отсутствует в enContentTexts.abilities');
    expect(typeof ability.name).toBe('string');
    expect(ability.name.length).toBeGreaterThan(0);
    expect(typeof ability.description).toBe('string');
    expect((ability.description ?? '').length).toBeGreaterThan(0);
  });
});
