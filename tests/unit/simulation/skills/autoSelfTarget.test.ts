import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTestTerrains, makeGameState, makePlayer} from '../../../fixtures/gameState';
import {createTestSimulation} from '../../../helpers/simulation';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate} from '../../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'fireball',
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('GameSimulation.getAbilityAutoSelfTarget', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['search', mockAbility('search', {kind: 'search', radius: 3})],
        ['counterattack', mockAbility('counterattack', {kind: 'selfBuff', statusType: 'counterattack', duration: 1})],
        ['ground_slam', mockAbility('ground_slam', {kind: 'groundSlam', radius: 1, baseDamage: 10})],
        ['fireball', mockAbility('fireball', {range: 5, aoeRadius: 1, centerDamage: 20, aoeDamage: 10})],
        ['dash', mockAbility('dash', {kind: 'dash', distance: 2, bumpDamage: 5})],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  function makeSim() {
    const state = makeGameState();
    const player = makePlayer({x: 5, y: 5});
    state.player = player;
    state.entities.set(player.id, player);
    return createTestSimulation(state);
  }

  it('возвращает клетку игрока для небоевой self-способности (search)', () => {
    const sim = makeSim();

    expect(sim.getAbilityAutoSelfTarget('search')).toEqual({x: 5, y: 5});
  });

  it('возвращает клетку игрока для self-бафа (counterattack)', () => {
    const sim = makeSim();

    expect(sim.getAbilityAutoSelfTarget('counterattack')).toEqual({x: 5, y: 5});
  });

  it('возвращает null для боевого self-скилла с зоной поражения (groundSlam)', () => {
    const sim = makeSim();

    expect(sim.getAbilityAutoSelfTarget('ground_slam')).toBeNull();
  });

  it('возвращает null для направленных способностей (fireball, dash)', () => {
    const sim = makeSim();

    expect(sim.getAbilityAutoSelfTarget('fireball')).toBeNull();
    expect(sim.getAbilityAutoSelfTarget('dash')).toBeNull();
  });

  it('возвращает null для неизвестной способности', () => {
    const sim = makeSim();

    expect(sim.getAbilityAutoSelfTarget('unknown_skill')).toBeNull();
  });
});
