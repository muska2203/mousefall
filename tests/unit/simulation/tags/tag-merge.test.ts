import { describe, expect, it } from 'vitest';
import { mergeDamageIntentTags } from '../../../../src/simulation/systems/tags/tag-helpers';

describe('mergeDamageIntentTags', () => {
  it('не дублирует damage-теги, сохраняя приоритет первого', () => {
    const result = mergeDamageIntentTags(
      ['damage.physical.slashing'],
      ['damage.physical.blunt', 'attack.melee'],
      ['target.single', 'delivery.weapon'],
    );

    expect(result).toEqual([
      'damage.physical.slashing',
      'attack.melee',
      'target.single',
      'delivery.weapon',
    ]);
  });

  it('сохраняет все non-damage теги из всех массивов', () => {
    const result = mergeDamageIntentTags(
      ['attack.melee'],
      ['target.single', 'delivery.weapon'],
      ['effect.burn'],
    );

    expect(result).toEqual(['attack.melee', 'target.single', 'delivery.weapon', 'effect.burn']);
  });

  it('удаляет дубликаты non-damage тегов', () => {
    const result = mergeDamageIntentTags(
      ['attack.melee', 'target.single'],
      ['attack.melee', 'delivery.weapon'],
    );

    expect(result).toEqual(['attack.melee', 'target.single', 'delivery.weapon']);
  });
});
