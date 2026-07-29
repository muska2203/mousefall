/**
 * Тесты разрушаемого объекта (пропа) на примере бочки с маслом.
 *
 * Проверяем базовые свойства:
 * - проп блокирует движение, если blocksMovement === true;
 * - проп не блокирует линию видимости, если blocksLOS === false;
 * - разрушенный проп не блокирует движение;
 * - проп может быть атакован и уничтожен.
 */

import { describe, it, expect } from 'vitest';
import { isBlocked, blocksLOS, findFirstAttackableEntityAt, findPropAt } from '../../../src/simulation/state';
import { attackEntity } from '../../../src/simulation/systems/actions/attack-action';
import { GameSimulation } from '../../../src/simulation/simulation';
import { advanceToPlayerTurn } from '../../helpers/simulation';
import type { PropEntity } from '../../../src/simulation/types';
import { makePlayer, makeProp, makeStateWithPlayerAndEntity } from '../../fixtures/gameState';

describe('Prop entity', () => {
  it('blocks movement when blocksMovement is true', () => {
    const prop = makeProp({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(makePlayer(), prop);

    expect(isBlocked(state, 4, 5)).toBe(true);
  });

  it('does not block line of sight when blocksLOS is false', () => {
    const prop = makeProp({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(makePlayer(), prop);

    expect(blocksLOS(state, 4, 5)).toBe(false);
  });

  it('blocks line of sight when blocksLOS is true', () => {
    const prop = makeProp({ x: 4, y: 5, blocksLOS: true });
    const state = makeStateWithPlayerAndEntity(makePlayer(), prop);

    expect(blocksLOS(state, 4, 5)).toBe(true);
  });

  it('does not block movement when destroyed', () => {
    const prop = makeProp({ x: 4, y: 5, isAlive: false, blocksMovement: false });
    const state = makeStateWithPlayerAndEntity(makePlayer(), prop);

    expect(isBlocked(state, 4, 5)).toBe(false);
  });

  it('is found by findPropAt', () => {
    const prop = makeProp({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(makePlayer(), prop);

    const found = findPropAt(state, 4, 5);
    expect(found).toBeDefined();
    expect(found?.id).toBe(prop.id);
  });

  it('is attackable', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10 });
    const prop = makeProp({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, prop);

    const target = findFirstAttackableEntityAt(state, 4, 5);
    expect(target).toBeDefined();
    expect(target?.type).toBe('prop');
  });

  it('takes damage and can be destroyed by melee attack', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10, baseStats: { str: 9, dex: 0, int: 0, vit: 0 }, maxAp: 1, ap: 1 });
    const prop = makeProp({ x: 4, y: 5, hp: 8, maxHp: 8, armor: 0 });
    const state = makeStateWithPlayerAndEntity(player, prop);

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    advanceToPlayerTurn(sim);

    expect(sim.getState().entities.has(prop.id)).toBe(false);
  });

  it('survives a weak melee attack', () => {
    const player = makePlayer({ x: 3, y: 5, damage: 10, baseStats: { str: 9, dex: 0, int: 0, vit: 0 }, maxAp: 1, ap: 1 });
    const prop = makeProp({ x: 4, y: 5, hp: 30, maxHp: 30, armor: 2 });
    const state = makeStateWithPlayerAndEntity(player, prop);

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });

    const updatedProp = sim.getState().entities.get(prop.id) as PropEntity;
    expect(updatedProp).toBeDefined();
    expect(updatedProp.isAlive).toBe(true);
    expect(updatedProp.hp).toBeLessThan(updatedProp.maxHp);
  });
});
