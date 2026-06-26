import { describe, expect, it } from 'vitest';
import { makeGameState, makeEnemy, makePlayer } from '../../../fixtures/gameState';
import { executeCleanupDeadEntitiesIntent } from '../../../../src/simulation/systems/intents/cleanup-dead-entities-intent-executor';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { PLAYER_ID } from '../../../../src/utils/constants';

describe('executeCleanupDeadEntitiesIntent', () => {
  it('удаляет мёртвых не-игроковых сущностей и порождает DEAD_ENTITIES_CLEANED', () => {
    const state = makeGameState();
    const aliveEnemy = makeEnemy({ id: 'alive_1', x: 3, y: 3, hp: 10, isAlive: true });
    const deadEnemy = makeEnemy({ id: 'dead_1', x: 4, y: 4, hp: 0, isAlive: false });
    state.entities.set(aliveEnemy.id, aliveEnemy);
    state.entities.set(deadEnemy.id, deadEnemy);

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 2, actorId: PLAYER_ID });
    const node = executeCleanupDeadEntitiesIntent(
      state,
      { type: 'CLEANUP_DEAD_ENTITIES' },
      builder,
      builder.root,
    );

    expect(state.entities.has(aliveEnemy.id)).toBe(true);
    expect(state.entities.has(deadEnemy.id)).toBe(false);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'DEAD_ENTITIES_CLEANED',
      removed: [{ entityId: deadEnemy.id, position: { x: 4, y: 4 } }],
    });
  });

  it('не трогает игрока, даже если он мёртв', () => {
    const player = makePlayer({ hp: 0, isAlive: false });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 2, actorId: PLAYER_ID });
    const node = executeCleanupDeadEntitiesIntent(
      state,
      { type: 'CLEANUP_DEAD_ENTITIES' },
      builder,
      builder.root,
    );

    expect(state.entities.has(player.id)).toBe(true);
    expect(state.player.isAlive).toBe(false);
    expect(node).toBeNull();
  });

  it('возвращает null, если нет мёртвых сущностей', () => {
    const state = makeGameState();
    const aliveEnemy = makeEnemy({ id: 'alive_1', x: 3, y: 3, hp: 10, isAlive: true });
    state.entities.set(aliveEnemy.id, aliveEnemy);

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 2, actorId: PLAYER_ID });
    const node = executeCleanupDeadEntitiesIntent(
      state,
      { type: 'CLEANUP_DEAD_ENTITIES' },
      builder,
      builder.root,
    );

    expect(state.entities.has(aliveEnemy.id)).toBe(true);
    expect(node).toBeNull();
  });

  it('сортирует удалённые сущности по id для детерминизма', () => {
    const state = makeGameState();
    const deadZ = makeEnemy({ id: 'dead_z', x: 1, y: 1, hp: 0, isAlive: false });
    const deadA = makeEnemy({ id: 'dead_a', x: 2, y: 2, hp: 0, isAlive: false });
    const deadM = makeEnemy({ id: 'dead_m', x: 3, y: 3, hp: 0, isAlive: false });
    state.entities.set(deadZ.id, deadZ);
    state.entities.set(deadA.id, deadA);
    state.entities.set(deadM.id, deadM);

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'PLAYER', round: 2, actorId: PLAYER_ID });
    const node = executeCleanupDeadEntitiesIntent(
      state,
      { type: 'CLEANUP_DEAD_ENTITIES' },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    const removedIds = (node!.event as { removed: { entityId: string }[] }).removed.map(r => r.entityId);
    expect(removedIds).toEqual([deadA.id, deadM.id, deadZ.id]);
  });
});
