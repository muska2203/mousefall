import { describe, it, expect } from 'vitest';
import { fireDamageReaction } from '../../../../src/simulation/systems/world-reactions/fire-damage-reaction';
import { makePlayer, makeEnemy, makeStateWithPlayerAndEntity, makeGameState } from '../../../fixtures/gameState';
import { createRNG } from '../../../../src/utils/rng';

function makeEntityDamagedEvent(targetId: string, damageType: import('../../../../src/simulation/core-types').DamageType) {
  return {
    type: 'ENTITY_DAMAGED' as const,
    targetId,
    damage: 5,
    damageType,
    position: { x: 0, y: 0 },
  };
}

describe('fireDamageReaction', () => {
  it('при огненном уроне с шансом 10% возвращает APPLY_STATUS с горением на 2 хода', () => {
    const enemy = makeEnemy();
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    state.rng = createRNG(7); // seed 7 даёт true для rngChance(10)

    const event = makeEntityDamagedEvent(enemy.id, 'fire');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: {
        type: 'burning',
        duration: 2,
        value: 0,
        statModifiers: null,
      },
    });
  });

  it('при огненном уроне без шанса возвращает пустой массив', () => {
    const enemy = makeEnemy();
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    state.rng = createRNG(6); // seed 6 даёт false для rngChance(10)

    const event = makeEntityDamagedEvent(enemy.id, 'fire');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('при не-огненном уроне возвращает пустой массив', () => {
    const enemy = makeEnemy();
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    state.rng = createRNG(7); // шанс сработал бы для огня

    const event = makeEntityDamagedEvent(enemy.id, 'blunt');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('не накладывает горение, если оно уже есть с длительностью >= 2', () => {
    const enemy = makeEnemy();
    enemy.statusEffects = [{ type: 'burning', duration: 3, value: 0, statModifiers: null }];
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    state.rng = createRNG(7); // шанс сработал

    const event = makeEntityDamagedEvent(enemy.id, 'fire');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('продлевает горение до 2 ходов, если текущая длительность меньше 2', () => {
    const enemy = makeEnemy();
    enemy.statusEffects = [{ type: 'burning', duration: 1, value: 0, statModifiers: null }];
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    state.rng = createRNG(7); // шанс сработал

    const event = makeEntityDamagedEvent(enemy.id, 'fire');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: {
        type: 'burning',
        duration: 2,
      },
    });
  });

  it('возвращает пустой массив, если цель не найдена', () => {
    const state = makeGameState();
    state.rng = createRNG(7);

    const event = makeEntityDamagedEvent('missing_entity', 'fire');
    const result = fireDamageReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });
});
