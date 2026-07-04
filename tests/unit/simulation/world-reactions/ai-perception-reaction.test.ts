import { describe, it, expect } from 'vitest';
import { aiPerceptionReaction } from '@simulation/systems/world-reactions/ai-perception-reaction';
import type { GameEvent } from '@simulation/types';
import { makeGameState, makeEnemy, makePlayer } from '../../../fixtures/gameState';
import type { Entity, EntityId, GameState } from '@simulation/types';

function createStateWithEnemies(playerX: number, playerY: number, enemies: Entity[]): GameState {
  const player = makePlayer({ x: playerX, y: playerY });
  const entities = new Map<EntityId, Entity>([[player.id, player], ...enemies.map((e) => [e.id, e] as [EntityId, Entity])]);
  return makeGameState({ player, entities });
}

describe('aiPerceptionReaction', () => {
  it('создаёт NOTIFY_AI для акторов в радиусе при движении игрока', () => {
    const nearEnemy = makeEnemy({ id: 'enemy_near', x: 5, y: 3, aiSightRadius: 3 });
    const farEnemy = makeEnemy({ id: 'enemy_far', x: 5, y: 1, aiSightRadius: 1 });
    const state = createStateWithEnemies(5, 5, [nearEnemy, farEnemy]);

    const event: GameEvent = {
      type: 'ENTITY_MOVED',
      entityId: 'player',
      from: { x: 5, y: 4 },
      to: { x: 5, y: 5 },
      movementType: 'walk',
    };

    const intents = aiPerceptionReaction(state, event, null as any, null as any);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      type: 'NOTIFY_AI',
      entityId: 'enemy_near',
      change: {
        kind: 'entity_moved',
        entityId: 'player',
        from: { x: 5, y: 4 },
        to: { x: 5, y: 5 },
      },
    });
  });

  it('не создаёт NOTIFY_AI для самого себя', () => {
    const enemy = makeEnemy({ id: 'enemy_self', x: 5, y: 3, aiSightRadius: 3 });
    const state = createStateWithEnemies(5, 5, [enemy]);

    const event: GameEvent = {
      type: 'ENTITY_MOVED',
      entityId: 'enemy_self',
      from: { x: 5, y: 4 },
      to: { x: 5, y: 3 },
      movementType: 'walk',
    };

    const intents = aiPerceptionReaction(state, event, null as any, null as any);

    expect(intents).toHaveLength(0);
  });

  it('создаёт NOTIFY_AI при открытии двери для акторов в радиусе', () => {
    const enemy = makeEnemy({ id: 'enemy_door', x: 5, y: 3, aiSightRadius: 3 });
    const state = createStateWithEnemies(5, 5, [enemy]);

    const event: GameEvent = {
      type: 'DOOR_OPENED',
      position: { x: 5, y: 4 },
    };

    const intents = aiPerceptionReaction(state, event, null as any, null as any);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      type: 'NOTIFY_AI',
      entityId: 'enemy_door',
      change: { kind: 'door_opened', position: { x: 5, y: 4 } },
    });
  });

  it('создаёт NOTIFY_AI при закрытии двери для акторов в радиусе', () => {
    const enemy = makeEnemy({ id: 'enemy_door', x: 5, y: 3, aiSightRadius: 3 });
    const state = createStateWithEnemies(5, 5, [enemy]);

    const event: GameEvent = {
      type: 'DOOR_CLOSED',
      position: { x: 5, y: 4 },
    };

    const intents = aiPerceptionReaction(state, event, null as any, null as any);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      type: 'NOTIFY_AI',
      entityId: 'enemy_door',
      change: { kind: 'door_closed', position: { x: 5, y: 4 } },
    });
  });

  it('игнорирует события, не интересные AI', () => {
    const enemy = makeEnemy({ id: 'enemy_irrelevant', x: 5, y: 3, aiSightRadius: 5 });
    const state = createStateWithEnemies(5, 5, [enemy]);

    const event: GameEvent = {
      type: 'RESOURCE_CONSUMED',
      entityId: 'player',
      resource: 'ap',
      amount: 1,
      remaining: 0,
    };

    const intents = aiPerceptionReaction(state, event, null as any, null as any);

    expect(intents).toHaveLength(0);
  });
});
