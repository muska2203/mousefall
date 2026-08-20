/**
 * Unit-тесты обобщённой реакции взрыва тайлового эффекта
 * (параметры взрыва читаются из поля `explosion` шаблона эффекта).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  tileEffectExplosionReaction
} from '../../../../src/simulation/systems/world-reactions/tile-effect-explosion-reaction';
import {
  tileExplosionDamageReaction
} from '../../../../src/simulation/systems/world-reactions/tile-explosion-damage-reaction';
import {initObjectContentRegistry, makeGameState} from '../../../fixtures/gameState';
import {resetRegistry} from '../../../../src/content/registry';
import {TileEffectTemplateSchema, type TileEffectTemplate} from '../../../../src/content/schemas';
import type {GameEvent} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';

function makeTileEffect(input: { id: string; explosion?: object }): TileEffectTemplate {
  return TileEffectTemplateSchema.parse({
    id: input.id,
    duration: 5,
    ...(input.explosion ? { explosion: input.explosion } : {}),
  });
}

function makeDummyBuilderAndParent() {
  const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null });
  return { builder, parent: builder.root };
}

function makeStatusAppliedEvent(effectType: string, statusType: string, isNew = true): GameEvent {
  return {
    type: 'TILE_EFFECT_STATUS_APPLIED', isFieldEvent: true,
    effectType,
    statusType,
    position: { x: 3, y: 3 },
    duration: 3,
    sourceEntityId: null,
    isNew,
  };
}

describe('tileEffectExplosionReaction', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      tileEffects: new Map([
        ['oil', makeTileEffect({
          id: 'oil',
          explosion: {
            triggerStatus: 'burning',
            damage: 2,
            radius: 1,
            consumesEffect: false,
            tags: ['damage.magical.fire'],
          },
        })],
        ['flour_cloud', makeTileEffect({
          id: 'flour_cloud',
          explosion: {
            triggerStatus: 'burning',
            damage: 5,
            radius: 1,
            consumesEffect: true,
            tags: ['damage.magical.fire'],
          },
        })],
        ['water', makeTileEffect({ id: 'water' })],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('порождает TILE_EXPLOSION при первом наложении статуса-триггера (масло)', () => {
    const state = makeGameState();
    const event = makeStatusAppliedEvent('oil', 'burning');

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = tileEffectExplosionReaction(state, event, builder, parent);

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

  it('при consumesEffect дополнительно порождает REMOVE_TILE_EFFECT', () => {
    const state = makeGameState();
    const event = makeStatusAppliedEvent('flour_cloud', 'burning');

    const { builder, parent } = makeDummyBuilderAndParent();
    const intents = tileEffectExplosionReaction(state, event, builder, parent);

    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({ type: 'TILE_EXPLOSION', damage: 5, radius: 1 });
    expect(intents[1]).toMatchObject({
      type: 'REMOVE_TILE_EFFECT',
      effectType: 'flour_cloud',
      position: { x: 3, y: 3 },
    });
  });

  it('не срабатывает при обновлении длительности статуса (isNew === false)', () => {
    const state = makeGameState();
    const event = makeStatusAppliedEvent('oil', 'burning', false);

    const { builder, parent } = makeDummyBuilderAndParent();
    expect(tileEffectExplosionReaction(state, event, builder, parent)).toHaveLength(0);
  });

  it('не срабатывает для эффекта без explosion или при другом статусе', () => {
    const state = makeGameState();

    // Эффект без поля explosion.
    const { builder: b1, parent: p1 } = makeDummyBuilderAndParent();
    expect(tileEffectExplosionReaction(state, makeStatusAppliedEvent('water', 'burning'), b1, p1)).toHaveLength(0);

    // Статус не совпадает с triggerStatus.
    const { builder: b2, parent: p2 } = makeDummyBuilderAndParent();
    expect(tileEffectExplosionReaction(state, makeStatusAppliedEvent('oil', 'frozen'), b2, p2)).toHaveLength(0);
  });
});

describe('tileExplosionDamageReaction', () => {
  it('превращает TILE_EXPLODED в DAMAGE_TILE по всем клеткам радиуса', () => {
    const state = makeGameState();
    const event: GameEvent = {
      type: 'TILE_EXPLODED', isFieldEvent: true,
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
      type: 'TILE_EXPLODED', isFieldEvent: true,
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
      type: 'TILE_EXPLODED', isFieldEvent: true,
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
