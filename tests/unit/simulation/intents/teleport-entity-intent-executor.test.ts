import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState.ts';
import { executeTeleportEntityIntent } from '@simulation/systems/intents/teleport-entity-intent-executor';
import { ExecutionBuilder } from '@simulation/systems/actions/types';
import type { Entity, EntityId } from '@simulation/types';

describe('executeTeleportEntityIntent', () => {
  it('перемещает сущность и эмитит ENTITY_MOVED с movementType teleport', () => {
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3 });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([['enemy_1', enemy]]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: 'player' },
    });

    const node = executeTeleportEntityIntent(
      state,
      { type: 'TELEPORT_ENTITY', entityId: 'enemy_1', x: 7, y: 8 },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ENTITY_MOVED');
    const event = node!.event as import('@simulation/types').EntityMovedEvent;
    expect(event.entityId).toBe('enemy_1');
    expect(event.from).toEqual({ x: 3, y: 3 });
    expect(event.to).toEqual({ x: 7, y: 8 });
    expect(event.movementType).toBe('teleport');

    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(8);
  });

  it('обновляет state.player при телепорте игрока', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, entities: new Map<EntityId, Entity>([['player', player]]) });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: 'player' },
    });

    executeTeleportEntityIntent(
      state,
      { type: 'TELEPORT_ENTITY', entityId: 'player', x: 1, y: 2 },
      builder,
      builder.root,
    );

    expect(state.player.x).toBe(1);
    expect(state.player.y).toBe(2);
  });

  it('возвращает null, если сущность не найдена', () => {
    const state = makeGameState();
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: 'player' },
    });

    const node = executeTeleportEntityIntent(
      state,
      { type: 'TELEPORT_ENTITY', entityId: 'missing', x: 1, y: 1 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
