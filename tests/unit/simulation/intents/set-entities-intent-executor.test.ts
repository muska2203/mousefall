import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState.ts';
import { executeSetEntitiesIntent } from '@simulation/systems/intents/set-entities-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';
import type { Entity, EntityId } from '@simulation/types';

describe('executeSetEntitiesIntent', () => {
  it('заменяет сущности и эмитит ENTITIES_REPLACED с отсортированными ID', () => {
    const player = makePlayer({ id: 'player' });
    const enemy = makeEnemy({ id: 'enemy_z' });
    const state = makeGameState({ player, entities: new Map<EntityId, Entity>([['player', player]]) });

    const newEntities = new Map<EntityId, Entity>([
      ['player', player],
      ['enemy_z', enemy],
      ['enemy_a', makeEnemy({ id: 'enemy_a' })],
    ]);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'WAIT', entityId: 'player' },
    });

    const node = executeSetEntitiesIntent(
      state,
      { type: 'SET_ENTITIES', entities: newEntities as Map<EntityId, unknown> },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ENTITIES_REPLACED');
    const event = node!.event as import('@simulation/core-types').EntitiesReplacedEvent;
    expect(event.entityIds).toEqual(['enemy_a', 'enemy_z', 'player']);

    expect(state.entities).toBe(newEntities);
    expect(state.player).toBe(player);
  });

  it('возвращает null, если в коллекции нет игрока', () => {
    const state = makeGameState();
    const entities = new Map<EntityId, Entity>([['enemy_1', makeEnemy({ id: 'enemy_1' })]]) as Map<EntityId, unknown>;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'WAIT', entityId: 'player' },
    });

    const node = executeSetEntitiesIntent(
      state,
      { type: 'SET_ENTITIES', entities },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
