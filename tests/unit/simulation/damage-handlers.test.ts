import { describe, it, expect } from 'vitest';
import { getDamageHandler } from '../../../src/simulation/systems/damage/damage-handlers';
import { makeEnemy, makeDoor } from '../../fixtures/gameState';

describe('getDamageHandler', () => {
  it('уменьшает физический урон на броню цели', () => {
    const target = makeEnemy({
      statModifiers: [{ stat: 'armor', value: 3, op: 'add', source: 'test' }],
    });
    const handler = getDamageHandler(['damage.physical.blunt']);

    const damage = handler.calculateDamage({
      rawDamage: 5,
      sourceEntityId: null,
      target,
      tags: ['damage.physical.blunt'],
    });

    expect(damage).toBe(2);
  });

  it('игнорирует броню для магического урона', () => {
    const target = makeEnemy({
      statModifiers: [{ stat: 'armor', value: 100, op: 'add', source: 'test' }],
    });
    const handler = getDamageHandler(['damage.magical.fire']);

    const damage = handler.calculateDamage({
      rawDamage: 5,
      sourceEntityId: null,
      target,
      tags: ['damage.magical.fire'],
    });

    expect(damage).toBe(5);
  });

  it('ограничивает физический урон минимумом 1, даже если броня выше урона', () => {
    const target = makeDoor({ armor: 10 });
    const handler = getDamageHandler(['damage.physical.blunt']);

    const damage = handler.calculateDamage({
      rawDamage: 5,
      sourceEntityId: null,
      target,
      tags: ['damage.physical.blunt'],
    });

    expect(damage).toBe(1);
  });
});
