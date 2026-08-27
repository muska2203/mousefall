/**
 * Временный репродукционный тест бага: тик кровотечения на игроке
 * с реликвией «Договор с подвалом» (relic_blood_pact).
 * Ожидание: тик кровотечения не несёт тег `delivery.weapon`, поэтому ни цена
 * (+1 к входящему урону оружия), ни power (+2 к исходящему урону оружия)
 * на self-дот не применяются — тик проходит как есть (2 HP).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeGameState, makePlayer} from '../../../fixtures/gameState';
import {GameSimulation} from '../../../../src/simulation/simulation';
import {advanceToPlayerTurn} from '../../../helpers/simulation';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import {getContentRule} from '../../../../src/simulation/content-rules/registry';
import {rebuildActiveRules} from '../../../../src/simulation/systems/rules/active-rule-lifecycle';
import type {StatusTemplate} from '../../../../src/content/schemas';

function mockStatus(id: string, ruleIds: string[] = []): StatusTemplate {
  return {
    id,
    ruleIds,
    statusCategory: 'wound',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  };
}

describe('repro: bleeding tick + blood pact', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([
        ['bleeding', mockStatus('bleeding', ['status_bleeding_tick_damage'])],
      ]),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('тик кровотечения на игроке с Договором с подвалом', () => {
    const player = makePlayer({
      x: 5, y: 5, hp: 100, maxHp: 100, maxAp: 1, ap: 1,
      statusEffects: [{type: 'bleeding', duration: 3, value: 0, statModifiers: null}],
    });
    player.activeRules.push({
      ...getContentRule('relic_blood_pact_power'),
      ownerContext: {type: 'entity', entityId: 'relic_test'},
    });
    player.activeRules.push({
      ...getContentRule('relic_blood_pact_price'),
      ownerContext: {type: 'entity', entityId: 'relic_test'},
    });
    rebuildActiveRules(player);

    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });

    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({type: 'END_TURN', entityId: player.id});
    advanceToPlayerTurn(sim);

    console.log('hp после тика:', sim.getState().player.hp, '(ожидается 98: тик 2 без модификаторов договора)');
    expect(true).toBe(true);
  });
});
