/**
 * Unit-тесты реакции взрыва горящего масла.
 */

import { describe, it, expect } from 'vitest';
import { burningOilExplosionReaction } from '../../../../src/simulation/systems/world-reactions/burning-oil-explosion-reaction';
import { tileExplosionDamageReaction } from '../../../../src/simulation/systems/world-reactions/tile-explosion-damage-reaction';
import { makeGameState } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { GameEvent } from '../../../../src/simulation/core-types';

function makeDummyBuilderAndParent() {
  const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: null });
  return { builder, parent: builder.root };
}

describe('burningOilExplosionReaction', () => {
  it('порождает TILE_EXPLOSION при первом наложении burning на oil', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EFFECT_STATUS_APPLIED',
      effectType: 'oil',
      statusType: 'burning',
      position: { x: 3, y: 3 },
      duration: 3,
      sourceEntityId: 'player_1',
      isNew: true,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = burningOilExplosionReaction(state, event, builder, parent);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'TILE_EXPLOSION',
      position: { x: 3, y: 3 },
      sourceEntityId: null,
      damage: 2,
      radius: 1,
      tags: ['damage.magical.fire'],
    });
  });

  it('не срабатывает при обновлении длительности burning (isNew === false)', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EFFECT_STATUS_APPLIED',
      effectType: 'oil',
      statusType: 'burning',
      position: { x: 3, y: 3 },
      duration: 3,
      sourceEntityId: null,
      isNew: false,
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = burningOilExplosionReaction(state, event, builder, parent);

    expect(intents).toHaveLength(0);
  });

  it('не срабатывает для других статусов или эффектов', () => {
    const state = makeGameState();

    const waterEvent: GameEvent = {
      type: 'TILE_EFFECT_STATUS_APPLIED',
      effectType: 'water',
      statusType: 'burning',
      position: { x: 3, y: 3 },
      duration: 3,
      sourceEntityId: null,
      isNew: true,
    };
    const { builder: b2, parent: p2 } = makeDummyBuilderAndParent();
    expect(burningOilExplosionReaction(state, waterEvent, b2, p2)).toHaveLength(0);

    const frozenEvent: GameEvent = {
      type: 'TILE_EFFECT_STATUS_APPLIED',
      effectType: 'oil',
      statusType: 'frozen',
      position: { x: 3, y: 3 },
      duration: 3,
      sourceEntityId: null,
      isNew: true,
    };
    const { builder: b3, parent: p3 } = makeDummyBuilderAndParent();
    expect(burningOilExplosionReaction(state, frozenEvent, b3, p3)).toHaveLength(0);
  });
});

describe('tileExplosionDamageReaction', () => {
  it('превращает TILE_EXPLODED в DAMAGE_TILE по всем клеткам радиуса', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EXPLODED',
      position: { x: 3, y: 3 },
      sourceEntityId: null,
      damage: 2,
      radius: 1,
      tags: ['damage.magical.fire'],
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = tileExplosionDamageReaction(state, event, builder, parent);

    expect(intents).toHaveLength(9);
    expect(intents.every((i) => i.type === 'DAMAGE_TILE')).toBe(true);
    expect(intents.every((i) => (i as any).damage === 2)).toBe(true);
    expect(intents.every((i) => (i as any).tags.includes('damage.magical.fire'))).toBe(true);

    const positions = intents.map((i) => (i as any).position);
    expect(positions).toContainEqual({ x: 3, y: 3 });
    expect(positions).toContainEqual({ x: 2, y: 2 });
    expect(positions).toContainEqual({ x: 4, y: 4 });
  });

  it('работает для радиуса 0 — только центральная клетка', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EXPLODED',
      position: { x: 3, y: 3 },
      sourceEntityId: null,
      damage: 5,
      radius: 0,
      tags: ['damage.magical.ice'],
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = tileExplosionDamageReaction(state, event, builder, parent);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'DAMAGE_TILE',
      position: { x: 3, y: 3 },
      damage: 5,
      tags: ['damage.magical.ice'],
    });
  });

  it('наследует sourceEntityId в DAMAGE_TILE', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EXPLODED',
      position: { x: 3, y: 3 },
      sourceEntityId: 'player_1',
      damage: 2,
      radius: 1,
      tags: ['damage.magical.fire'],
    };

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = tileExplosionDamageReaction(state, event, builder, parent);

    expect(intents.every((i) => (i as any).sourceEntityId === 'player_1')).toBe(true);
  });
});
