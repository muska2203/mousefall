import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { counterAttackReaction } from '../../../../src/simulation/systems/world-reactions/counter-attack-reaction';
import { makePlayer, makeEnemy, makeStateWithPlayerAndEntity } from '../../../fixtures/gameState';
import * as randomModule from '../../../../src/utils/random';
import type { EntityDamagedEvent } from '../../../../src/simulation/core-types';

function makeEntityDamagedEvent(
  targetId: string,
  sourceEntityId: string | null,
  tags: string[],
  position = { x: 5, y: 5 },
): EntityDamagedEvent {
  return {
    type: 'ENTITY_DAMAGED',
    targetId,
    sourceEntityId,
    damage: 5,
    position,
    tags,
  };
}

describe('counterAttackReaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('возвращает COUNTER_ATTACK, когда все теги на месте, цель имеет статус и источник рядом', () => {
    vi.spyOn(randomModule, 'randomChance').mockReturnValue(true);

    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_counter',
      x: 6,
      y: 5,
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeEntityDamagedEvent(enemy.id, player.id, ['attack.melee', 'target.single', 'delivery.weapon']);
    const result = counterAttackReaction(state, event, null as any, null as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'COUNTER_ATTACK',
      counterAttackerId: enemy.id,
      targetId: player.id,
      dx: -1,
      dy: 0,
    });
  });

  it('возвращает пустой массив, если не хватает нужных тегов', () => {
    vi.spyOn(randomModule, 'randomChance').mockReturnValue(true);

    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_counter',
      x: 6,
      y: 5,
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeEntityDamagedEvent(enemy.id, player.id, ['attack.melee']);
    const result = counterAttackReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('возвращает пустой массив, если у цели нет статуса контратаки', () => {
    vi.spyOn(randomModule, 'randomChance').mockReturnValue(true);

    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_no_counter', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeEntityDamagedEvent(enemy.id, player.id, ['attack.melee', 'target.single', 'delivery.weapon']);
    const result = counterAttackReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('возвращает пустой массив, если источник не находится на соседней клетке', () => {
    vi.spyOn(randomModule, 'randomChance').mockReturnValue(true);

    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_counter',
      x: 8,
      y: 5,
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeEntityDamagedEvent(enemy.id, player.id, ['attack.melee', 'target.single', 'delivery.weapon']);
    const result = counterAttackReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });

  it('возвращает пустой массив при провале шанса 50%', () => {
    vi.spyOn(randomModule, 'randomChance').mockReturnValue(false);

    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_counter',
      x: 6,
      y: 5,
      statusEffects: [{ type: 'counterattack', duration: 2, value: 0, statModifiers: null }],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const event = makeEntityDamagedEvent(enemy.id, player.id, ['attack.melee', 'target.single', 'delivery.weapon']);
    const result = counterAttackReaction(state, event, null as any, null as any);

    expect(result).toEqual([]);
  });
});
