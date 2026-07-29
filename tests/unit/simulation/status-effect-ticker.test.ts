import {describe, expect, it} from 'vitest';
import {tickObjectStatusEffects, tickEntityStatusEffects} from '../../../src/simulation/systems/status-effect-ticker';
import {makeDoor, makeGameState, makePlayer, makeProp} from '../../fixtures/gameState';
import type {Entity} from '../../../src/simulation/types';

describe('tickObjectStatusEffects', () => {
  it('возвращает интенты для дверей и пропов с тикающими статусами', () => {
    const door = makeDoor({ statusEffects: [{ type: 'burning', duration: 2, value: 0, statModifiers: null }] });
    const prop = makeProp({ statusEffects: [{ type: 'burning', duration: 1, value: 0, statModifiers: null }] });
    const state = makeGameState({ entities: new Map<string, Entity>([[door.id, door], [prop.id, prop]]) });

    const result = tickObjectStatusEffects(state, 'environment');

    expect(result).toHaveLength(2);
    expect(result.map(r => r.entity.id).sort()).toEqual([door.id, prop.id].sort());
    expect(result[0]!.intents[0]!).toMatchObject({ type: 'TICK_STATUS_EFFECTS', entityId: expect.any(String), phase: 'environment' });
  });

  it('пропускает акторов', () => {
    const player = makePlayer({ statusEffects: [{ type: 'burning', duration: 2, value: 0, statModifiers: null }] });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const result = tickObjectStatusEffects(state, 'environment');

    expect(result).toHaveLength(0);
  });

  it('пропускает мёртвые объекты', () => {
    const door = makeDoor({ isAlive: false, statusEffects: [{ type: 'burning', duration: 2, value: 0, statModifiers: null }] });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const result = tickObjectStatusEffects(state, 'environment');

    expect(result).toHaveLength(0);
  });

  it('tickEntityStatusEffects не возвращает интент, если активен только stunned', () => {
    const door = makeDoor({ statusEffects: [{ type: 'stunned', duration: 2, value: 0, statModifiers: null }] });

    const intents = tickEntityStatusEffects(door, 'environment');

    expect(intents).toHaveLength(0);
  });
});
