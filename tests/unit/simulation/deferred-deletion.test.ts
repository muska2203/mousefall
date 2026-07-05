import { describe, it, expect } from 'vitest';
import { executeDieIntent } from '../../../src/simulation/systems/intents/die-intent-executer';
import { deathReaction } from '../../../src/simulation/systems/world-reactions/death-reaction';
import { findAttackableEntity, isBlocked } from '../../../src/simulation/state';
import { executeCleanupDeadEntitiesIntent } from '../../../src/simulation/systems/intents/cleanup-dead-entities-intent-executor';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { makeGameState, makeEnemy, makePlayer } from '../../fixtures/gameState';
import { PLAYER_ID } from '../../../src/utils/constants';

describe('Deferred Deletion', () => {
  it('executeDieIntent помечает врага isAlive=false, но не удаляет из entities', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 1, isAlive: true });
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: enemy.id } });
    const result = executeDieIntent(
      state,
      { type: 'DIE', entityId: enemy.id, position: { x: 3, y: 3 } },
      builder,
      builder.root,
    );

    expect(result).not.toBeNull();
    expect(enemy.isAlive).toBe(false);
    expect(enemy.blocksMovement).toBe(false);
    expect(state.entities.has(enemy.id)).toBe(true);
  });

  it('executeDieIntent помечает игрока isAlive=false и переводит phase в dead', () => {
    const state = makeGameState();
    const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: PLAYER_ID } });
    const result = executeDieIntent(
      state,
      { type: 'DIE', entityId: PLAYER_ID, position: { x: 5, y: 5 } },
      builder,
      builder.root,
    );

    expect(result).not.toBeNull();
    expect(state.player.isAlive).toBe(false);
    expect(state.player.hp).toBe(0);
    expect(state.phase).toBe('dead');
  });

  it('findAttackableEntity возвращает undefined для мёртвой сущности', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 0, isAlive: false });
    state.entities.set(enemy.id, enemy);

    expect(findAttackableEntity(state, enemy.id)).toBeUndefined();
  });

  it('findAttackableEntity возвращает сущность для живой сущности', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 10, isAlive: true });
    state.entities.set(enemy.id, enemy);

    const found = findAttackableEntity(state, enemy.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(enemy.id);
  });

  it('executeCleanupDeadEntitiesIntent физически удаляет мёртвых через интент', () => {
    const state = makeGameState();
    const aliveEnemy = makeEnemy({ id: 'alive_1', x: 3, y: 3, hp: 10, isAlive: true });
    const deadEnemy = makeEnemy({ id: 'dead_1', x: 4, y: 4, hp: 0, isAlive: false });
    state.entities.set(aliveEnemy.id, aliveEnemy);
    state.entities.set(deadEnemy.id, deadEnemy);

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 2, actorId: PLAYER_ID });
    executeCleanupDeadEntitiesIntent(state, { type: 'CLEANUP_DEAD_ENTITIES' }, builder, builder.root);

    expect(state.entities.has(aliveEnemy.id)).toBe(true);
    expect(state.entities.has(deadEnemy.id)).toBe(false);
  });

  it('deathReaction не срабатывает дважды на одну сущность', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 0, isAlive: false });
    state.entities.set(enemy.id, enemy);

    const result = deathReaction(
      state,
      { type: 'ENTITY_DAMAGED', targetId: enemy.id, damage: 5, damageType: 'blunt', position: { x: 3, y: 3 } },
      null as any,
      null as any,
    );

    expect(result).toEqual([]);
  });

  it('deathReaction срабатывает для живой сущности с hp <= 0', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 0, isAlive: true });
    state.entities.set(enemy.id, enemy);

    const result = deathReaction(
      state,
      { type: 'ENTITY_DAMAGED', targetId: enemy.id, damage: 5, damageType: 'blunt', position: { x: 3, y: 3 } },
      null as any,
      null as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'DIE', entityId: enemy.id, position: { x: 3, y: 3 } });
  });

  it('мёртвая сущность не блокирует проход (blocksMovement=false)', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 3, y: 3, hp: 0, isAlive: false, blocksMovement: false });
    state.entities.set(enemy.id, enemy);

    // isBlocked проверяет entities с blocksMovement === true
    // если blocksMovement false, проход должен быть свободен
    expect(isBlocked(state, 3, 3)).toBe(false);
  });
});
