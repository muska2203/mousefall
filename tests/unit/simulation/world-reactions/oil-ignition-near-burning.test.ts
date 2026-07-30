/**
 * Unit-тесты реакции автоматического поджога масла рядом с горящим маслом.
 */

import {describe, expect, it} from 'vitest';
import {oilIgnitionNearBurningReaction} from '../../../../src/simulation/systems/world-reactions/oil-ignition-near-burning-reaction';
import {makeGameState} from '../../../fixtures/gameState';
import type {GameEvent, TileEffectInstance} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';

function makeDummyBuilderAndParent() {
  const builder = new ExecutionBuilder({
    type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null,
  });
  return { builder, parent: builder.root };
}

function makeOilInstance(burning: boolean): TileEffectInstance {
  return {
    type: 'oil',
    duration: 5,
    layer: 'cover',
    statusEffects: burning ? [{ type: 'burning', duration: 3, renderOrder: 10 }] : [],
    renderOrder: 2,
  };
}

describe('oilIgnitionNearBurningReaction', () => {
  it('поджигает свежее масло, появившееся в соседней клетке от горящего масла', () => {
    const state = makeGameState();
    state.tileEffects[4]![4] = { cover: makeOilInstance(true) };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'oil',
      position: { x: 4, y: 5 },
      isNew: true,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = oilIgnitionNearBurningReaction(state, event, builder, parent);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_TILE_EFFECT_STATUS',
      effectType: 'oil',
      statusType: 'burning',
      position: { x: 4, y: 5 },
      duration: 3,
      sourceEntityId: null,
    });
  });

  it('не поджигает масло, если рядом нет горящего масла', () => {
    const state = makeGameState();
    state.tileEffects[4]![4] = { cover: makeOilInstance(false) };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'oil',
      position: { x: 4, y: 5 },
      isNew: true,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = oilIgnitionNearBurningReaction(state, event, builder, parent);

    expect(intents).toHaveLength(0);
  });

  it('не срабатывает при обновлении длительности масла (isNew === false)', () => {
    const state = makeGameState();
    state.tileEffects[4]![4] = { cover: makeOilInstance(true) };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'oil',
      position: { x: 4, y: 5 },
      isNew: false,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = oilIgnitionNearBurningReaction(state, event, builder, parent);

    expect(intents).toHaveLength(0);
  });

  it('не срабатывает для тайловых эффектов, отличных от масла', () => {
    const state = makeGameState();
    state.tileEffects[4]![4] = { cover: makeOilInstance(true) };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'water',
      position: { x: 4, y: 5 },
      isNew: true,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = oilIgnitionNearBurningReaction(state, event, builder, parent);

    expect(intents).toHaveLength(0);
  });
});
